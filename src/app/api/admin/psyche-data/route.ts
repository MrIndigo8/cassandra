import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { context, response } = await getAdminContext('admin');
  if (!context) return response!;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'global';
  const countryIso = searchParams.get('country_iso')?.trim().toUpperCase() || null;
  const period = searchParams.get('period') || '6h';
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const admin = context.adminSupabase;

  let globalSnap: unknown = null;
  const { data: g } = await admin
    .from('global_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  globalSnap = g ?? null;

  let geoQuery = admin.from('geo_snapshots').select('*').eq('snapshot_period', period);

  if (dateFrom) geoQuery = geoQuery.gte('period_start', new Date(dateFrom).toISOString());
  if (dateTo) geoQuery = geoQuery.lte('period_end', new Date(dateTo).toISOString());
  if (!dateFrom && !dateTo) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    geoQuery = geoQuery.gte('period_start', weekAgo.toISOString());
  }

  const { data: geoList, error: geoErr } = await geoQuery.order('entry_count', { ascending: false });

  if (geoErr) {
    return NextResponse.json({ error: geoErr.message }, { status: 500 });
  }

  let countryDetail: unknown = null;
  let countryHistory: unknown[] = [];
  if (view === 'country' && countryIso) {
    const { data: c } = await admin
      .from('geo_snapshots')
      .select('*')
      .eq('country_iso', countryIso)
      .eq('snapshot_period', period)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    countryDetail = c;

    const { data: hist } = await admin
      .from('geo_snapshots')
      .select('*')
      .eq('country_iso', countryIso)
      .eq('snapshot_period', period)
      .order('period_start', { ascending: false })
      .limit(28);
    countryHistory = (hist || []).slice().reverse();
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const { data: globals7d } = await admin
    .from('global_snapshots')
    .select('snapshot_date, global_emotional, global_coherence')
    .gte('snapshot_date', sevenDaysAgo.toISOString().split('T')[0]!)
    .order('snapshot_date', { ascending: true });

  const anxiety7d =
    globals7d?.map((row) => {
      const ge = row.global_emotional as { spectrum?: Record<string, number> } | null;
      const anx = ge?.spectrum?.anxiety ?? null;
      return {
        date: row.snapshot_date,
        value: anx != null ? Math.round(anx * 1000) / 1000 : null,
      };
    }) ?? [];

  const coherence7d =
    globals7d?.map((row) => ({
      date: row.snapshot_date,
      value: row.global_coherence,
    })) ?? [];

  return NextResponse.json({
    global: globalSnap,
    geo: geoList ?? [],
    country: countryDetail,
    country_history: countryHistory,
    trends: {
      anxiety_7d: anxiety7d,
      coherence_7d: coherence7d,
    },
    meta: { view, period, country_iso: countryIso },
  });
}
