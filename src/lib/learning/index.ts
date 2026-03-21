import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Самообучение профиля пользователя.
 * Анализирует все совпадения и обновляет:
 * - dominant_images: топ-5 образов которые чаще всего совпадали
 * - avg_lag_days: среднее количество дней между записью и событием
 * - avg_specificity: средняя специфичность всех записей
 */
export async function updateUserProfile(userId: string): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Learning] Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Загружаем все совпадения пользователя с данными записей
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('similarity_score, matched_symbols, event_date, entry_id')
    .eq('user_id', userId)
    .gt('similarity_score', 0.6);

  if (matchesError || !matches || matches.length === 0) {
    return;
  }

  // Собираем entry_ids для запроса записей
  const entryIds = Array.from(new Set(matches.map(m => m.entry_id)));

  const { data: entries } = await supabase
    .from('entries')
    .select('id, created_at, ai_specificity, ai_images')
    .in('id', entryIds);

  const entriesMap = new Map<string, { created_at: string; ai_specificity: number | null; ai_images: string[] | null }>();
  if (entries) {
    for (const e of entries) {
      entriesMap.set(e.id, e);
    }
  }

  // 2. Подсчитать dominant_images: топ-5 образов из matched_symbols
  const imageCounts = new Map<string, number>();
  for (const match of matches) {
    if (Array.isArray(match.matched_symbols)) {
      for (const sym of match.matched_symbols) {
        imageCounts.set(sym, (imageCounts.get(sym) || 0) + 1);
      }
    }
  }

  const dominantImages = Array.from(imageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([img]) => img);

  // 3. Подсчитать avg_lag_days
  let totalLag = 0;
  let lagCount = 0;
  for (const match of matches) {
    const entry = entriesMap.get(match.entry_id);
    if (entry && match.event_date) {
      const entryDate = new Date(entry.created_at).getTime();
      const eventDate = new Date(match.event_date).getTime();
      const lagDays = (eventDate - entryDate) / (1000 * 3600 * 24);
      if (lagDays >= 0) {
        totalLag += lagDays;
        lagCount++;
      }
    }
  }
  const avgLagDays = lagCount > 0 ? totalLag / lagCount : 0;

  // 4. Подсчитать avg_specificity по всем записям пользователя
  const { data: allEntries } = await supabase
    .from('entries')
    .select('ai_specificity')
    .eq('user_id', userId)
    .not('ai_specificity', 'is', null);

  let avgSpecificity = 0;
  if (allEntries && allEntries.length > 0) {
    const sum = allEntries.reduce((s, e) => s + (e.ai_specificity || 0), 0);
    avgSpecificity = sum / allEntries.length;
  }

  // 5. Обновить профиль
  const { error: updateError } = await supabase.from('users').update({
    dominant_images: dominantImages,
    avg_specificity: Math.round(avgSpecificity * 100) / 100,
    avg_lag_days: Math.round(avgLagDays * 10) / 10,
  }).eq('id', userId);

  if (updateError) {
    console.error('[Learning] Ошибка обновления профиля:', updateError);
  } else {
    console.log(`[Learning] Профиль ${userId}: images=${dominantImages.join(',')}, lag=${avgLagDays.toFixed(1)}d, spec=${avgSpecificity.toFixed(2)}`);
  }
}
