import { NextResponse } from 'next/server';
import { getAdminContext, logAdminAction } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';

const ACTION_MAP: Record<string, { path: string; actionType: string }> = {
  analyze: { path: '/api/analyze', actionType: 'run_analyze' },
  verify: { path: '/api/verify', actionType: 'run_verify' },
  cluster: { path: '/api/cluster', actionType: 'run_cluster' },
};

export async function POST(request: Request) {
  const { context, response } = await getAdminContext('admin');
  if (!context) return response!;
  if (!hasPermission(context.role, 'canAccessApi')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { task } = (await request.json()) as { task: 'analyze' | 'verify' | 'cluster' };
  const mapped = ACTION_MAP[task];
  if (!mapped) return NextResponse.json({ error: 'Unknown task' }, { status: 400 });

  const cronSecret = process.env.CRON_SECRET;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);

  const resp = await fetch(`${appUrl}${mapped.path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    cache: 'no-store',
  });
  const data = await resp.json().catch(() => ({}));

  await logAdminAction({
    adminSupabase: context.adminSupabase,
    adminId: context.userId,
    actionType: mapped.actionType,
    details: { status: resp.status, data },
  });

  return NextResponse.json({ ok: resp.ok, status: resp.status, data });
}
