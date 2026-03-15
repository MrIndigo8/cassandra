import { NextResponse } from 'next/server';
import { runVerification } from '@/lib/verification';

// Важно для Vercel Cron
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 минут (максимум для Hobby)

export async function POST(request: Request) {
  try {
    // В идеале сюда стоит добавить проверку Bearer токена из хедера Authorization
    // который присылает Vercel (CRON_SECRET).
    // Подробнее: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      if (process.env.NODE_ENV !== 'development') {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[API /verify] Запуск проверки...');
    const result = await runVerification();
    console.log('[API /verify] Завершено:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /verify] Ошибка:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
