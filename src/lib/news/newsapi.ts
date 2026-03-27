import { NewsAudienceProfile, NewsEvent } from './types';

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

const GEO_KEYWORDS = [
  'poland', 'polish', 'europe', 'eu', 'iran', 'israel', 'ukraine', 'russia',
  'germany', 'france', 'italy', 'spain', 'middle east', 'warsaw', 'tehran',
  'bitcoin', 'crypto',
];

function extractGeography(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('poland') || lower.includes('polish') || lower.includes('warsaw')) return 'Poland';
  if (lower.includes('iran') || lower.includes('tehran')) return 'Iran';
  if (lower.includes('israel')) return 'Israel';
  if (lower.includes('ukraine')) return 'Ukraine';
  if (lower.includes('russia')) return 'Russia';
  if (lower.includes('germany')) return 'Germany';
  if (lower.includes('france')) return 'France';
  if (lower.includes('italy')) return 'Italy';
  if (lower.includes('spain')) return 'Spain';
  if (lower.includes('europe') || lower.includes('eu')) return 'Europe';
  if (lower.includes('middle east')) return 'Middle East';
  if (lower.includes('usa') || lower.includes('united states') || lower.includes('america')) return 'USA';
  return null;
}

/**
 * Получает последние новости из NewsAPI.
 * @param daysBack - количество дней назад для поиска
 */
export async function fetchRecentNews(
  daysBack: number,
  audience?: NewsAudienceProfile
): Promise<NewsEvent[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.warn('[NewsAPI] NEWSAPI_KEY не задан, пропускаем источник');
    return [];
  }

  try {
    const from = new Date();
    from.setDate(from.getDate() - daysBack);
    const fromStr = from.toISOString().split('T')[0]; // YYYY-MM-DD

    // Запрашиваем целевые ленты: гео + тематика + локальные европейские top headlines.
    const results: NewsEvent[] = [];
    const dedupe = new Set<string>();

    const requests: URL[] = [];

    const countries = new Set(
      (audience?.preferredCountries || []).map((c) => c.toLowerCase())
    );
    const regions = new Set(
      (audience?.preferredRegions || []).map((r) => r.toLowerCase())
    );
    const topics = new Set(
      (audience?.preferredTopics || []).map((t) => t.toLowerCase())
    );

    const needsIran = topics.has('iran') || topics.has('middle east') || topics.has('war');
    const needsCrypto = topics.has('crypto') || topics.has('bitcoin') || topics.has('btc');
    const needsEurope = countries.has('pl') || countries.has('poland') || regions.has('europe');

    const querySets = [
      { q: '(iran OR israel OR "middle east") AND (war OR conflict OR strike)', language: 'en' },
      { q: '(bitcoin OR btc OR crypto OR ethereum) AND (market OR regulation OR etf OR price)', language: 'en' },
      { q: '(poland OR europe OR eu OR ukraine) AND (security OR economy OR war OR policy)', language: 'en' },
      { q: '(иран OR израиль OR ближний восток OR биткоин OR крипто OR польша OR европа)', language: 'ru' },
    ];
    if (needsIran) {
      querySets.unshift({
        q: '(iran OR tehran OR israel OR "middle east") AND (war OR missile OR strike OR conflict)',
        language: 'en',
      });
    }
    if (needsCrypto) {
      querySets.unshift({
        q: '(bitcoin OR btc OR crypto OR ethereum) AND (price OR market OR regulation OR etf)',
        language: 'en',
      });
    }
    if (needsEurope) {
      querySets.unshift({
        q: '(poland OR europe OR eu OR warsaw OR brussels) AND (security OR economy OR conflict)',
        language: 'en',
      });
    }

    for (const query of querySets) {
      const url = new URL('https://newsapi.org/v2/everything');
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('q', query.q);
      url.searchParams.set('language', query.language);
      url.searchParams.set('sortBy', 'publishedAt');
      url.searchParams.set('pageSize', '40');
      url.searchParams.set('from', fromStr);
      requests.push(url);
    }

    const topHeadlineCountries = ['pl', 'de', 'fr'];
    if (countries.has('pl') || countries.has('poland')) topHeadlineCountries.unshift('pl');
    if (countries.has('de') || countries.has('germany')) topHeadlineCountries.unshift('de');
    if (countries.has('fr') || countries.has('france')) topHeadlineCountries.unshift('fr');
    if (countries.has('it') || countries.has('italy')) topHeadlineCountries.push('it');
    if (countries.has('es') || countries.has('spain')) topHeadlineCountries.push('es');

    for (const country of topHeadlineCountries) {
      const url = new URL('https://newsapi.org/v2/top-headlines');
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('country', country);
      url.searchParams.set('pageSize', '30');
      requests.push(url);
    }

    for (const url of requests) {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        console.error(`[NewsAPI] Ошибка ${response.status} для ${url.pathname}:`, await response.text());
        continue;
      }

      const data: NewsApiResponse = await response.json();

      if (data.status !== 'ok') {
        console.error('[NewsAPI] Неуспешный статус:', data);
        continue;
      }

      const mapped: NewsEvent[] = data.articles
        .filter((a) => a.title && a.title !== '[Removed]')
        .filter((a) => {
          const text = `${a.title} ${a.description || ''}`.toLowerCase();
          return GEO_KEYWORDS.some((kw) => text.includes(kw));
        })
        .map((article) => ({
          id: `newsapi-${Buffer.from(article.url).toString('base64').slice(0, 16)}`,
          source: 'newsapi' as const,
          title: article.title,
          description: article.description || '',
          url: article.url,
          publishedAt: new Date(article.publishedAt),
          category: 'news',
          geography: extractGeography(`${article.title} ${article.description || ''}`),
          severity: 'medium' as const,
        }));

      for (const event of mapped) {
        const key = event.url || event.title.toLowerCase();
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        results.push(event);
      }
    }

    console.log(`[NewsAPI] Получено ${results.length} событий`);
    return results;
  } catch (error) {
    console.error('[NewsAPI] Ошибка при получении новостей:', error);
    return [];
  }
}
