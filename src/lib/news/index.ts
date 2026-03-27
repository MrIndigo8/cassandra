import { NewsAudienceProfile, NewsEvent } from './types';
import { fetchRecentNews } from './newsapi';
import { fetchEarthquakes } from './usgs';
import { fetchGuardianNews } from './guardian';

export { type NewsEvent } from './types';

/**
 * Получает события из всех источников параллельно.
 * Объединяет, дедуплицирует по title, логирует статистику.
 *
 * @param daysBack - количество дней назад для поиска
 */
export async function fetchAllEvents(
  daysBack: number,
  audience?: NewsAudienceProfile
): Promise<NewsEvent[]> {
  const [newsApiEvents, usgsEvents, guardianEvents] = await Promise.all([
    fetchRecentNews(daysBack, audience),
    fetchEarthquakes(daysBack),
    fetchGuardianNews(daysBack)
  ]);

  console.log(`[NewsAPI] Получено ${newsApiEvents.length} событий`);
  console.log(`[USGS] Получено ${usgsEvents.length} землетрясений`);
  console.log(`[Guardian] Получено ${guardianEvents.length} событий`);

  const allEvents = [...newsApiEvents, ...usgsEvents, ...guardianEvents];
  
  // Дедупликация по заголовку
  const seen = new Set<string>();
  return allEvents.filter(event => {
    const key = event.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
