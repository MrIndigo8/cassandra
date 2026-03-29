import { NextResponse } from 'next/server';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type CronStep = {
  path: string;
  critical?: boolean;
};

const CRON_STEPS: CronStep[] = [
  { path: '/api/external-sync' },
  { path: '/api/analyze', critical: true },
  { path: '/api/verify', critical: true },
  { path: '/api/coherence', critical: true },
];

const CRON_PARALLEL_TAIL: CronStep[] = [
  { path: '/api/cluster' },
  { path: '/api/recalculate-scores' },
  { path: '/api/reality-snapshot' },
];

async function runStep(
  appUrl: string,
  cronSecret: string,
  step: CronStep
): Promise<{ path: string; ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${appUrl}${step.path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
    cache: 'no-store',
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    path: step.path,
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function runCron(request: Request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedResponse();
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 500 }
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);

  const startedAt = Date.now();
  const results: Array<{
    path: string;
    ok: boolean;
    status: number;
    body: unknown;
  }> = [];

  for (const step of CRON_STEPS) {
    const stepResult = await runStep(appUrl, cronSecret, step);
    results.push(stepResult);

    if (step.critical && !stepResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          interruptedAt: step.path,
          durationMs: Date.now() - startedAt,
          results,
        },
        { status: 500 }
      );
    }
  }

  const tailResults = await Promise.all(CRON_PARALLEL_TAIL.map((step) => runStep(appUrl, cronSecret, step)));
  results.push(...tailResults);

  const snapshotResult = await runStep(appUrl, cronSecret, {
    path: '/api/admin/generate-snapshots',
  });
  results.push(snapshotResult);

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    durationMs: Date.now() - startedAt,
    results,
  });
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
