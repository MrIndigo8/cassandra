import { NewsEvent } from './types';

export async function fetchGuardianNews(daysBack: number): Promise<NewsEvent[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) {
    console.log('[Guardian] API ключ не найден');
    return [];
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    const url = `https://content.guardianapis.com/search?` +
      `from-date=${fromDateStr}` +
      `&order-by=newest` +
      `&page-size=50` +
      `&show-fields=bodyText,trailText` +
      `&api-key=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CassandraApp/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Guardian API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const results = data.response?.results || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((item: any): NewsEvent => ({
      id: item.id,
      source: 'guardian',
      title: item.webTitle,
      description: item.fields?.trailText || item.fields?.bodyText?.slice(0, 300) || '',
      url: item.webUrl,
      publishedAt: new Date(item.webPublicationDate),
      category: item.sectionName || 'general',
      geography: extractGeography(item.webTitle + ' ' + (item.fields?.trailText || '')),
      severity: 'medium'
    }));
  } catch (error) {
    console.error('[Guardian] Ошибка:', error);
    return [];
  }
}

function extractGeography(text: string): string | null {
  const countries = [
    'Russia', 'Ukraine', 'USA', 'China', 'UK', 'France', 'Germany',
    'Israel', 'Iran', 'Turkey', 'India', 'Brazil', 'Japan', 'Korea',
    'Syria', 'Gaza', 'Pakistan', 'Afghanistan', 'Europe', 'Middle East'
  ];
  for (const country of countries) {
    if (text.includes(country)) return country;
  }
  return null;
}
