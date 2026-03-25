import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAllEvents } from '@/lib/news';

export const dynamic = 'force-dynamic';

// GET /api/map-data — данные для всех трёх слоёв карты
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Слой 1: активность платформы по странам за 48 часов
    const { data: activityData } = await supabase
      .from('entries')
      .select('ip_country_code, ip_geography')
      .gte('created_at', since48h)
      .not('ip_geography', 'is', null);

    const activityMap: Record<string, number> = {};
    activityData?.forEach(entry => {
      if (entry.ip_country_code) {
        activityMap[entry.ip_country_code] = (activityMap[entry.ip_country_code] || 0) + 1;
      }
    });

    // Слой 2: кластеры тревожности из снов
    const { data: clusters } = await supabase
      .from('clusters')
      .select('geography_data, intensity_score, dominant_images, ai_prediction')
      .eq('is_resolved', false)
      .order('intensity_score', { ascending: false });

    const anxietyMap: Record<string, number> = {};
    clusters?.forEach(cluster => {
      const geoData = cluster.geography_data as any;
      if (geoData?.countries) {
        Object.entries(geoData.countries).forEach(([country]) => {
          anxietyMap[country] = Math.max(
            anxietyMap[country] || 0,
            cluster.intensity_score || 0
          );
        });
      }
    });

    // Слой 3: реальные события из новостей
    const events = await fetchAllEvents(2);
    const worldEvents = events
      .filter(e => e.geography)
      .slice(0, 50)
      .map(e => ({
        title: e.title,
        geography: e.geography,
        severity: e.severity,
        source: e.source,
        publishedAt: e.publishedAt,
        url: e.url
      }));

    return NextResponse.json({
      activityMap,      // { "RU": 45, "US": 23, ... }
      anxietyMap,       // { "Turkey": 7.2, "France": 3.1, ... }
      worldEvents,      // массив событий с географией
      clusters          // активные кластеры
    });
  } catch (error) {
    console.error('Error in /api/map-data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
