import { NextResponse } from 'next/server';
import { runClustering } from '@/lib/clustering';

export const maxDuration = 60; // Максимальное время выполнения (Vercel Hobby plan = 10-60s)

/**
 * Endpoint для запуска кластеризации
 * /api/cluster
 */
export async function POST(request: Request) {
  try {
    // В идеале здесь должна быть проверка на авторизацию админа или cron-секрета
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await runClustering();

    return NextResponse.json({ 
      status: 'success', 
      clusters_found: stats.clusters_found,
      anomalies: stats.anomalies
    });
  } catch (error) {
    console.error('[API Clustering] Ошибка:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
