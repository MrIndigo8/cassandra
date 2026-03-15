import { NewsEvent } from './types';
import { fetchRecentNews } from './newsapi';
import { fetchEarthquakes } from './usgs';

export { type NewsEvent } from './types';

/**
 * Получает события из всех источников параллельно.
 * Объединяет, дедуплицирует по title, логирует статистику.
 *
 * @param daysBack - количество дней назад для поиска
 */
export async function fetchAllEvents(daysBack: number): Promise<NewsEvent[]> {
  console.log(`[News] Запрос событий за последние ${daysBack} дня(ей)...`);

  // Параллельный запрос ко всем источникам
  const [newsApiEvents, usgsEvents] = await Promise.all([
    fetchRecentNews(daysBack),
    fetchEarthquakes(daysBack),
  ]);

  // Статистика по источникам
  const stats = {
    newsapi: newsApiEvents.length,
    usgs: usgsEvents.length,
  };

  console.log('[News] Статистика:', JSON.stringify(stats));

  // Объединяем все события
  const allEvents = [...newsApiEvents, ...usgsEvents];

  // Дедупликация по нормализованному title
  const seen = new Set<string>();
  const unique: NewsEvent[] = [];

  for (const event of allEvents) {
    const key = event.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  const removed = allEvents.length - unique.length;
  if (removed > 0) {
    console.log(`[News] Удалено ${removed} дубликатов`);
  }

  console.log(`[News] Итого уникальных событий: ${unique.length}`);

  // Сортируем по дате (новые первые)
  unique.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return unique;
}
