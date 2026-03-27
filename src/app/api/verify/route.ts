import { NextResponse } from 'next/server';
import { runVerification } from '@/lib/verification';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { isFeatureEnabled } from '@/lib/features';

// Важно для Vercel Cron
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 минут (максимум для Hobby)

export async function POST(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return unauthorizedResponse();
    }
    if (!(await isFeatureEnabled('verification_enabled'))) {
      return NextResponse.json({ skipped: true, reason: 'Feature disabled by admin' });
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
