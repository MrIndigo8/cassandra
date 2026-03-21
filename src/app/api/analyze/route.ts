import { NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/analysis';

export const maxDuration = 60; // Максимальное время выполнения (Vercel Hobby plan = 10-60s)

export async function POST(request: Request) {
  try {
    // В Vercel Cron запросы приходят с хедером Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { processed } = await runAnalysis();

    return NextResponse.json({ processed });

  } catch (error) {
    console.error('[API Analyze] Необработанная ошибка:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
