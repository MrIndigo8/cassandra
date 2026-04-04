import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { runProcessTouchpointsBatch } from '@/lib/engagement/process-touchpoints-runner';

/**
 * Тот же пайплайн, что /api/process-touchpoints, но лимит 50 строк за вызов.
 * Предназначен для внешнего cron (GitHub Actions, cron-job.org) чаще 1 раза в сутки,
 * пока Vercel Hobby ограничивает один cron.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const result = await runProcessTouchpointsBatch(supabase, { limit: 50 });
    return NextResponse.json({ ...result, mode: 'light' as const });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
