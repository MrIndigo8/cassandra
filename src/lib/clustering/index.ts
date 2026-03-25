import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { CLUSTER_SIGNAL_PROMPT } from '../claude/prompts';
import { fetchAllEvents } from '../news';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
  : null;

// Интерфейс ответа Claude для кластера
interface ClusterAIResult {
  signal_strength: number;
  signal_type: string;
  geography_focus: string;
  time_horizon: string;
  prediction: string;
  confidence: string;
  supporting_events: string[];
}

/**
 * Основная функция кластеризации
 * Вызывается по cron
 */
export async function runClustering(): Promise<{ clusters_found: number; anomalies: number }> {
  if (process.env.NODE_ENV !== 'production') console.info('[Clustering] Начало анализа кластеров...');
  
  let clustersFound = 0;
  let anomaliesFound = 0;

  // 1. Получаем записи за последние 48 часов, у которых есть образы
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

  const { data: recentEntries, error: recentError } = await supabase
    .from('entries')
    .select('id, user_id, ai_images, ai_emotions, ai_geography, ip_geography, ip_country_code, timeframe')
    .gte('created_at', fortyEightHoursAgo.toISOString())
    .not('ai_images', 'is', null)
    .neq('is_quarantine', true);

  if (recentError || !recentEntries) {
    console.error('[Clustering] Ошибка получения недавних записей:', recentError);
    return { clusters_found: 0, anomalies: 0 };
  }

  // 2. Подсчитываем частоту каждого образа за 48 часов
  const imageCounts: Record<string, { count: number; users: Set<string>; entryIds: string[] }> = {};

  for (const entry of recentEntries) {
    if (!entry.ai_images) continue;

    for (const image of entry.ai_images) {
      if (!imageCounts[image]) {
        imageCounts[image] = { count: 0, users: new Set(), entryIds: [] };
      }
      imageCounts[image].count += 1;
      imageCounts[image].users.add(entry.user_id);
      imageCounts[image].entryIds.push(entry.id);
    }
  }

  // Оставляем только те образы, которые упоминались хотя бы 2 разными людьми
  const significantImages = Object.entries(imageCounts)
    .filter(([, data]) => data.users.size >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  clustersFound = significantImages.length;


  // 3. Загружаем baseline (базовую частоту) за 30 дней для сравнения
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: baselineEntries, error: baselineError } = await supabase
    .from('entries')
    .select('ai_images')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .not('ai_images', 'is', null);

  if (baselineError) {
    console.error('[Clustering] Ошибка получения baseline:', baselineError);
    return { clusters_found: clustersFound, anomalies: anomaliesFound };
  }

  const baselineCounts: Record<string, number> = {};
  if (baselineEntries) {
    for (const entry of baselineEntries) {
      if (!entry.ai_images) continue;
      for (const image of entry.ai_images) {
        baselineCounts[image] = (baselineCounts[image] || 0) + 1;
      }
    }
  }

  // 4. Ищем аномалии
  for (const [image, currentData] of significantImages) {
    // Рассчитываем норму (baseline) для 48 часов на основе 30-дневной статистики
    // 30 дней = 15 периодов по 48 часов
    const baseline48h = Math.max(1, (baselineCounts[image] || 0) / 15);

    // Аномалия: рост в X раз
    const anomalyFactor = currentData.count / baseline48h;



    // Если текущих упоминаний больше 2 и рост более 2x от нормы
    if (currentData.count > 2 && anomalyFactor > 2.0) {
      // Это аномальный кластер!
      anomaliesFound++;

      // Расчет intensity_score = (current / baseline) * log(unique_users + 1)
      const intensityScore = anomalyFactor * Math.log(currentData.users.size + 1);

      if (process.env.NODE_ENV !== 'production') console.info(`[Clustering] АНОМАЛИЯ обнаружена! Интенсивность: ${intensityScore.toFixed(2)}`);

      // Генерация ID кластера на основе базового образа (slugify)
      const clusterId = `cluster_${image.toLowerCase().replace(/[^a-z0-9а-яё]/g, '_')}`;

      // Если интенсивность > 2.0, подключаем ИИ для прогноза
      let aiAnalysis: ClusterAIResult | null = null;
      if (intensityScore > 2.0 && anthropic) {

        aiAnalysis = await analyzeClusterWithAI(image, currentData, baseline48h, anomalyFactor, recentEntries);
      }

      // Сохраняем в БД
      await saveCluster(clusterId, image, currentData, baseline48h, anomalyFactor, intensityScore, aiAnalysis, recentEntries);
    }
  }

  if (process.env.NODE_ENV !== 'production') console.info(`[Clustering] Анализ завершен. Кластеров: ${clustersFound}, Аномалий: ${anomaliesFound}`);
  return { clusters_found: clustersFound, anomalies: anomaliesFound };
}

// Вспомогательная функция для вызова ИИ
async function analyzeClusterWithAI(
  dominantImage: string,
  data: { count: number; users: Set<string>; entryIds: string[] },
  baseline: number,
  anomalyFactor: number,
  allEntries: { id: string; ai_geography: string | null; ip_geography: string | null; ip_country_code: string | null; timeframe: string | null }[]
): Promise<ClusterAIResult | null> {
  try {
    // Собираем контекст из записей этого кластера
    const clusterEntries = allEntries.filter(e => data.entryIds.includes(e.id));

    // Собираем географию
    const geos = clusterEntries.map(e => e.ai_geography).filter(Boolean);
    const geography = geos.length > 0 ? Array.from(new Set(geos)).join(', ') : 'Не определено';

    // Собираем временные рамки
    const timeframes = clusterEntries.map(e => e.timeframe).filter((tf): tf is string => Boolean(tf));
    const timeframeDistribution = timeframes.reduce((acc, tf) => {
      acc[tf] = (acc[tf] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Получаем текущие мировые события
    const events = await fetchAllEvents(3); // события за последние 3 дня
    const eventsContext = events.map(e => `- ${e.title} (${e.geography || 'мир'})`).slice(0, 10).join('\n');

    const prompt = CLUSTER_SIGNAL_PROMPT
      .replace('{images}', dominantImage)
      .replace('{count}', data.count.toString())
      .replace('{baseline}', baseline.toFixed(1))
      .replace('{factor}', anomalyFactor.toFixed(1))
      .replace('{geography}', geography)
      .replace('{timeframe_distribution}', JSON.stringify(timeframeDistribution))
      .replace('{world_events}', eventsContext || 'Нет значимых событий');

    const response = await anthropic!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0.2, // Строгость для аналитики
      system: prompt,
      messages: [{ role: 'user', content: `Проанализируй кластер "${dominantImage}". Верни только JSON.` }],
    });

    const responseText = response.content.find((block) => block.type === 'text')?.text;

    if (!responseText) return null;

    // Очистка и парсинг JSON
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.replace(/^```json/, '');
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.replace(/^```/, '');
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.replace(/```$/, '');

    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanedText) as Partial<ClusterAIResult>;

    return {
      signal_strength: parsed.signal_strength || 0,
      signal_type: parsed.signal_type || 'unknown',
      geography_focus: parsed.geography_focus || '',
      time_horizon: parsed.time_horizon || '',
      prediction: parsed.prediction || '',
      confidence: parsed.confidence || 'low',
      supporting_events: Array.isArray(parsed.supporting_events) ? parsed.supporting_events : []
    };

  } catch (err) {
    console.error('[Clustering AI] Ошибка:', err);
    return null;
  }
}

// Собираем географию из двух источников
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildGeographyData(entries: any[]): Promise<{ countries: Record<string, { count: number; percentage: number }> }> {
  const geoCount: Record<string, number> = {};
  let total = 0;
  
  for (const entry of entries) {
    const geo = entry.ip_country_code;
    
    if (geo) {
      const normalized = geo.trim().toUpperCase();
      geoCount[normalized] = (geoCount[normalized] || 0) + 1;
      total++;
    }
  }
  
  const countriesData: Record<string, { count: number; percentage: number }> = {};
  if (total > 0) {
    for (const [code, count] of Object.entries(geoCount)) {
      countriesData[code] = {
        count,
        percentage: Math.round((count / total) * 100)
      };
    }
  }
  
  return { countries: countriesData };
}

// Вспомогательная функция для сохранения в БД
async function saveCluster(
  id: string,
  image: string,
  data: { count: number; users: Set<string>; entryIds: string[] },
  baseline: number,
  anomalyFactor: number,
  intensityScore: number,
  aiAnalysis: ClusterAIResult | null,
  allEntries: { id: string; ai_geography: string | null; ip_geography: string | null; ip_country_code: string | null; timeframe: string | null }[]
) {
  // Собираем geography_data из записей кластера
  const clusterEntries = allEntries.filter(e => data.entryIds.includes(e.id));
  const geographyData = await buildGeographyData(clusterEntries);
  const clusterData = {
    id,
    title: `Кластер: ${image}`,
    description: aiAnalysis?.prediction || `Аномальный всплеск образа "${image}"`,
    symbols: [image],
    themes: [],
    entry_ids: data.entryIds,
    user_count: data.users.size,
    anomaly_score: aiAnalysis?.signal_strength || Math.min(1.0, anomalyFactor / 10),
    baseline_frequency: baseline,
    current_frequency: data.count,
    geo_center: aiAnalysis?.geography_focus || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Новые поля из миграции 004
    dominant_images: [image],
    entry_count: data.count,
    unique_users: data.users.size,
    intensity_score: intensityScore,
    baseline_count: Math.round(baseline),
    anomaly_factor: anomalyFactor,
    ai_prediction: aiAnalysis?.prediction || null,
    prediction_confidence: aiAnalysis ? (aiAnalysis.confidence === 'high' ? 0.9 : aiAnalysis.confidence === 'medium' ? 0.6 : 0.3) : 0,
    signal_type: aiAnalysis?.signal_type || 'unknown',
    time_horizon: aiAnalysis?.time_horizon || null,
    geography_data: Object.keys(geographyData).length > 0 ? geographyData : null,
  };

  const { error } = await supabase
    .from('clusters')
    .upsert(clusterData, { onConflict: 'id' });

  if (error) {
    console.error(`[Clustering] Ошибка сохранения кластера ${id}:`, error);
  } else {

  }
}
