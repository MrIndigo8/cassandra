import { NextResponse } from 'next/server';
import { fetchAllEvents } from '@/lib/news';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await fetchAllEvents(3);

    // Статистика по источникам
    const stats = {
      total: events.length,
      newsapi: events.filter((e) => e.source === 'newsapi').length,
      usgs: events.filter((e) => e.source === 'usgs').length,
      sample: events.slice(0, 5).map((e) => ({
        source: e.source,
        title: e.title,
        severity: e.severity,
        geography: e.geography,
        publishedAt: e.publishedAt,
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[news-test] Ошибка:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
