import { NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/analysis';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';

export const maxDuration = 60; // Максимальное время выполнения (Vercel Hobby plan = 10-60s)

export async function POST(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return unauthorizedResponse();
    }

    const { processed } = await runAnalysis();

    return NextResponse.json({ processed });

  } catch (error) {
    console.error('[API Analyze] Необработанная ошибка:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
