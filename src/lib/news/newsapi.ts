import { NewsEvent } from './types';

interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

/**
 * Получает последние новости из NewsAPI.
 * @param daysBack - количество дней назад для поиска
 */
export async function fetchRecentNews(daysBack: number): Promise<NewsEvent[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.warn('[NewsAPI] NEWSAPI_KEY не задан, пропускаем источник');
    return [];
  }

  try {
    const from = new Date();
    from.setDate(from.getDate() - daysBack);
    const fromStr = from.toISOString().split('T')[0]; // YYYY-MM-DD

    // Запрашиваем топ-новости на двух языках
    const results: NewsEvent[] = [];

    for (const lang of ['ru', 'en']) {
      const url = new URL('https://newsapi.org/v2/top-headlines');
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('language', lang);
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('from', fromStr);

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`[NewsAPI] Ошибка ${response.status} для lang=${lang}:`, await response.text());
        continue;
      }

      const data: NewsApiResponse = await response.json();

      if (data.status !== 'ok') {
        console.error('[NewsAPI] Неуспешный статус:', data);
        continue;
      }

      const mapped: NewsEvent[] = data.articles
        .filter((a) => a.title && a.title !== '[Removed]')
        .map((article) => ({
          id: `newsapi-${Buffer.from(article.url).toString('base64').slice(0, 16)}`,
          source: 'newsapi' as const,
          title: article.title,
          description: article.description || '',
          url: article.url,
          publishedAt: new Date(article.publishedAt),
          category: 'news',
          geography: null,
          severity: 'medium' as const,
        }));

      results.push(...mapped);
    }

    console.log(`[NewsAPI] Получено ${results.length} событий`);
    return results;
  } catch (error) {
    console.error('[NewsAPI] Ошибка при получении новостей:', error);
    return [];
  }
}
