import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recoverStuckAnalysisLocks, runAnalysis, runAnalysisForEntryIds } from '@/lib/analysis';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { isFeatureEnabled } from '@/lib/features';

export const maxDuration = 60;

function triggerVerifyChain() {
  const cronSecret = process.env.CRON_SECRET;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (cronSecret && appUrl) {
    fetch(`${appUrl}/api/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => {});
  }
}

async function handleAnalyze(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return unauthorizedResponse();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      const admin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
      await recoverStuckAnalysisLocks(admin);
    }

    if (!(await isFeatureEnabled('analysis_enabled'))) {
      return NextResponse.json({ skipped: true, reason: 'Feature disabled by admin' });
    }

    const { searchParams } = new URL(request.url);
    const entryIdsParam = searchParams.get('entryIds');
    const entryIds =
      entryIdsParam
        ?.split(',')
        .map((s) => s.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id)) ?? [];

    let processed = 0;

    if (entryIds.length > 0) {
      const result = await runAnalysisForEntryIds(entryIds);
      processed = result.processed;
      triggerVerifyChain();
      return NextResponse.json({ processed, mode: 'targeted' as const });
    }

    const batch = await runAnalysis();
    processed = batch.processed;

    triggerVerifyChain();

    return NextResponse.json({ processed, mode: 'batch' as const });
  } catch (error) {
    console.error('[API Analyze] Необработанная ошибка:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET удобен для cron/health и `curl -H "Authorization: Bearer …"`. */
export async function GET(request: Request) {
  return handleAnalyze(request);
}

export async function POST(request: Request) {
  return handleAnalyze(request);
}
