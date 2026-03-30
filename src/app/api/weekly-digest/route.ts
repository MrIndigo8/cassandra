import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { generateWeeklyDigest } from '@/lib/engagement/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function currentWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const now = new Date();
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === '1';
  if (!force && now.getUTCDay() !== 0) {
    return NextResponse.json({ processed: 0, skipped: true, reason: 'not_sunday' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activeEntries } = await supabase
    .from('entries')
    .select('user_id')
    .gte('created_at', weekAgo)
    .limit(5000);

  const userIds = Array.from(new Set((activeEntries || []).map((e) => e.user_id))).filter(Boolean);
  if (userIds.length === 0) return NextResponse.json({ processed: 0 });

  const weekKey = currentWeekKey(now);
  const { data: existingRows } = await supabase
    .from('notifications')
    .select('user_id, data')
    .eq('action_type', 'weekly_report')
    .gte('created_at', weekAgo);

  const alreadySent = new Set(
    (existingRows || [])
      .filter((r) => ((r.data as { week_key?: string } | null)?.week_key || '') === weekKey)
      .map((r) => r.user_id)
  );

  let processed = 0;
  for (const userId of userIds) {
    if (alreadySent.has(userId)) continue;
    const digest = await generateWeeklyDigest(userId, supabase);
    if (!digest) continue;

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'weekly_digest',
      action_type: 'weekly_report',
      title: digest.title,
      message: digest.message,
      status: 'unread',
      data: { template: 'weekly_digest', week_key: weekKey },
    });
    if (!error) processed++;
  }

  return NextResponse.json({ processed, week_key: weekKey, users: userIds.length });
}
