import { createServerSupabaseClient } from '@/lib/supabase/server';
import NoosphereMap from './NoosphereMap';
import { getTranslations } from 'next-intl/server';

export const revalidate = 0; // Всегда свежие данные

export const metadata = {
  title: 'Ноосфера | Кассандра',
  description: 'Глобальный трекер коллективного бессознательного',
};

// Функция для форматирования даты
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export default async function NoospherePage() {
  const t = await getTranslations('noosphere');
  const supabase = createServerSupabaseClient();

  // --- СЕКЦИЯ 1: Индекс тревоги ---
  // и СЕКЦИЯ 3: Активные кластеры
  // и СЕКЦИЯ 4: Карта мира (данные)
  const { data: activeClusters } = await supabase
    .from('clusters')
    .select('*')
    .eq('is_resolved', false)
    .order('intensity_score', { ascending: false });

  const clusters = activeClusters || [];
  
  // Рассчет индекса тревоги
  const anxietyIndex = clusters.length > 0 
    ? (clusters.reduce((sum, c) => sum + (c.intensity_score || 0), 0) / clusters.length).toFixed(1)
    : "0.0";
  
  const anxietyNum = parseFloat(anxietyIndex);
  let anxietyColor = "text-green-500";
  if (anxietyNum >= 4) anxietyColor = "text-yellow-500";
  if (anxietyNum >= 7) anxietyColor = "text-red-500";

  // Подготовка данных для карты мира
  const mapData: Record<string, { countryName: string; intensity: number; topImages: string[] }> = {};
  
  clusters.forEach(cluster => {
    // В geography_data мы храним строку или JSON. Предположим это строка вида "Russia, USA" (пока так делает ИИ)
    // Разделяем по запятой и агрегируем
    if (cluster.geography_data) {
      const geoStr = typeof cluster.geography_data === 'string' 
        ? cluster.geography_data 
        : JSON.stringify(cluster.geography_data);
      
      const countries = geoStr.split(',').map((c: string) => c.trim().replace(/['"]/g, ''));
      
      countries.forEach((country: string) => {
        if (!country || country === t('notDefined') || country === 'null') return;
        
        if (!mapData[country]) {
          mapData[country] = {
            countryName: country,
            intensity: 0,
            topImages: []
          };
        }
        
        // Суммируем интенсивность для региона
        mapData[country].intensity += (cluster.intensity_score || 0);
        
        // Добавляем доминирующий образ
        if (cluster.dominant_images && cluster.dominant_images.length > 0) {
          const img = cluster.dominant_images[0];
          if (!mapData[country].topImages.includes(img)) {
            mapData[country].topImages.push(img);
          }
        }
      });
    }
  });


  // --- СЕКЦИЯ 2: Топ образов ---
  // Получаем записи за 48 часов
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
  
  const { data: recentEntries } = await supabase
    .from('entries')
    .select('ai_images')
    .gte('created_at', fortyEightHoursAgo.toISOString())
    .not('ai_images', 'is', null);

  // Получаем baseline за 30 дней
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: baselineEntries } = await supabase
    .from('entries')
    .select('ai_images')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .not('ai_images', 'is', null);

  // Считаем текущую частоту
  const currentImagesCount: Record<string, number> = {};
  if (recentEntries) {
    recentEntries.forEach(entry => {
      entry.ai_images?.forEach((img: string) => {
        currentImagesCount[img] = (currentImagesCount[img] || 0) + 1;
      });
    });
  }

  // Считаем базовую частоту
  const baselineImagesCount: Record<string, number> = {};
  if (baselineEntries) {
    baselineEntries.forEach(entry => {
      entry.ai_images?.forEach((img: string) => {
        baselineImagesCount[img] = (baselineImagesCount[img] || 0) + 1;
      });
    });
  }

  // Формируем топ-10
  const topImagesList = Object.entries(currentImagesCount)
    .map(([image, currentCount]) => {
      // Норма за 48 часов, исходя из 30 дневного периода (15 отрезков по 48ч)
      const baseline48h = Math.max(1, (baselineImagesCount[image] || 0) / 15);
      const growthPercent = Math.round(((currentCount / baseline48h) - 1) * 100);
      
      return {
        image,
        count: currentCount,
        growth: growthPercent > 0 ? `+${growthPercent}%` : `${growthPercent}%`
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);


  // --- СЕКЦИЯ 5: История совпадений ---
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      entries ( created_at, ai_images )
    `)
    .order('created_at', { ascending: false })
    .limit(10);


  return (
    <div className="max-w-[1024px] mx-auto px-4 py-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 font-mono tracking-tight">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Секция 1: Индекс тревоги */}
        <div className="bg-surface border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <div className={`text-[80px] leading-none font-bold tracking-tighter mb-2 ${anxietyColor}`}>
            {anxietyIndex}
          </div>
          <div className="text-sm font-medium text-gray-900 uppercase tracking-widest mb-1">{t('anxietyIndex')}</div>
          <div className="text-xs text-gray-400">{t('last48h')}</div>
        </div>

        {/* Секция 2: Топ образов */}
        <div className="md:col-span-2 bg-surface border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            {t('topImages')}
          </h2>
          
          {topImagesList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {topImagesList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-mono text-xs">{idx + 1}.</span>
                    <span className="font-medium text-gray-800 capitalize">{item.image}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-900 font-semibold">{item.count}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.growth.startsWith('+') && parseInt(item.growth) > 50 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {item.growth}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-gray-400 text-sm italic">
              {t('notEnoughSignals')}
            </div>
          )}
        </div>
      </div>

      {/* Секция 4: Карта Мира */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          {t('geography')}
        </h2>
        <NoosphereMap />
      </div>

      {/* Секция 3: Активные кластеры */}
      <div className="mb-12">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          {t('activeAnomalies')}
        </h2>
        
        {clusters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusters.map((cluster) => {
              const signalLvl = cluster.intensity_score || 0;
              let signalBadge = { text: t('low'), color: 'bg-green-100 text-green-700 border-green-200' };
              if (signalLvl >= 3) signalBadge = { text: t('medium'), color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
              if (signalLvl >= 6) signalBadge = { text: t('high'), color: 'bg-red-100 text-red-700 border-red-200' };

              return (
                <div key={cluster.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${signalBadge.color}`}>
                          {t('signalLevel')}: {signalBadge.text} ({signalLvl.toFixed(1)})
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {formatDate(cluster.created_at)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">{cluster.title}</h3>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cluster.dominant_images?.map((img: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded border border-gray-100">
                        #{img}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Охват</span>
                      <span className="font-medium text-gray-900">{cluster.entry_count} записей ({cluster.unique_users} чел.)</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Локации</span>
                      <span className="font-medium text-gray-900 line-clamp-1">{typeof cluster.geography_data === 'string' ? cluster.geography_data : (cluster.geography_data ? JSON.stringify(cluster.geography_data) : t('global'))}</span>
                    </div>
                  </div>

                  {cluster.ai_prediction && (
                    <div className="bg-blue-50/50 rounded-lg p-3 text-sm border border-blue-100">
                      <span className="block text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        {t('aiPrediction')}
                      </span>
                      <p className="text-blue-900 italic leading-relaxed">{cluster.ai_prediction}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 text-sm">
            {t('noAnomalies')}
          </div>
        )}
      </div>

      {/* Секция 5: История совпадений */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          {t('matchHistory')}
        </h2>
        
        {matches && matches.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-mono">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('signal')}</th>
                    <th className="px-4 py-3 font-medium">{t('event')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('accuracy')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {matches.map((match) => (
                    <tr key={match.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 align-top min-w-[200px]">
                        <div className="font-medium text-gray-900 mb-1">
                          {formatDate(match.entries?.created_at || match.created_at)}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {match.entries?.ai_images?.slice(0, 3).map((img: string, i: number) => (
                            <span key={i} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{img}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[300px]">
                        <div className="font-medium text-gray-900 mb-1">{match.event_title}</div>
                        <div className="text-gray-500 text-xs line-clamp-2">{match.event_description}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${
                          match.match_score > 0.8 ? 'bg-green-100 text-green-700' :
                          match.match_score > 0.5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {Math.round(match.match_score * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 text-sm italic">
            {t('noHistoryYet')}
          </div>
        )}
      </div>

    </div>
  );
}
