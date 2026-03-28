import { NextResponse } from 'next/server';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Ежедневный агрегат «снимка реальности» (заглушка: счётчики + фиксированный индекс).
 * Вызывается из cron с CRON_SECRET.
 */
export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedResponse();
  }

  const admin = createAdminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const [{ count: entryCount }, { count: userCount }] = await Promise.all([
    admin.from('entries').select('id', { count: 'exact', head: true }),
    admin.from('users').select('id', { count: 'exact', head: true }),
  ]);

  const totalEntries = entryCount ?? 0;
  const totalUsers = userCount ?? 0;

  const coherenceIndex = totalEntries > 0 ? Math.min(1, 0.35 + Math.log10(totalEntries + 1) / 10) : 0;

  const { error } = await admin.from('reality_snapshots').upsert(
    {
      snapshot_date: snapshotDate,
      dominant_scenes: {},
      emotional_weather: {},
      archetype_activity: {},
      coherence_index: coherenceIndex,
      coherence_change: null,
      anomalies: [],
      prediction: null,
      total_entries_analyzed: totalEntries,
      total_users: totalUsers,
    },
    { onConflict: 'snapshot_date' }
  );

  if (error) {
    console.error('[reality-snapshot]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    snapshot_date: snapshotDate,
    total_entries_analyzed: totalEntries,
    total_users: totalUsers,
    coherence_index: coherenceIndex,
  });
}
