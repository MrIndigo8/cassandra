import { NextResponse } from 'next/server';
import { runClustering } from '@/lib/clustering';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';

export const maxDuration = 60; // Максимальное время выполнения (Vercel Hobby plan = 10-60s)

/**
 * Endpoint для запуска кластеризации
 * /api/cluster
 */
export async function POST(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return unauthorizedResponse();
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
