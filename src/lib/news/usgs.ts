import { NewsEvent } from './types';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
    title: string;
    type: string;
  };
}

interface USGSResponse {
  type: string;
  metadata: { count: number };
  features: USGSFeature[];
}

function magnitudeToSeverity(mag: number): 'low' | 'medium' | 'high' {
  if (mag >= 7) return 'high';
  if (mag >= 6) return 'medium';
  return 'low';
}

/**
 * Получает данные о землетрясениях из USGS Earthquake API.
 * @param daysBack - количество дней назад для поиска
 */
export async function fetchEarthquakes(daysBack: number): Promise<NewsEvent[]> {
  try {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - daysBack);

    const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('minmagnitude', '5.0');
    url.searchParams.set('starttime', startTime.toISOString().split('T')[0]);
    url.searchParams.set('endtime', endTime.toISOString().split('T')[0]);
    url.searchParams.set('orderby', 'time');
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`[USGS] Ошибка ${response.status}:`, await response.text());
      return [];
    }

    const data: USGSResponse = await response.json();

    const events: NewsEvent[] = data.features.map((feature) => ({
      id: `usgs-${feature.id}`,
      source: 'usgs' as const,
      title: feature.properties.title,
      description: `Землетрясение магнитудой ${feature.properties.mag} — ${feature.properties.place}`,
      url: feature.properties.url,
      publishedAt: new Date(feature.properties.time),
      category: 'earthquake',
      geography: feature.properties.place || null,
      severity: magnitudeToSeverity(feature.properties.mag),
    }));

    console.log(`[USGS] Получено ${events.length} землетрясений`);
    return events;
  } catch (error) {
    console.error('[USGS] Ошибка при получении данных о землетрясениях:', error);
    return [];
  }
}
