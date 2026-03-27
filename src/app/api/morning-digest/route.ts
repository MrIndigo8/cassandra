import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sinceYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: profile }, { data: latestEntry }, { data: topMatch }, { data: hotZoneRows }, { data: coherence }] = await Promise.all([
      supabase.from('users').select('streak_count').eq('id', user.id).single(),
      supabase
        .from('entries')
        .select('id, content, ai_summary, ai_analyzed_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('matches')
        .select('id, similarity_score, event_title, event_date')
        .gte('created_at', sinceYesterday)
        .order('similarity_score', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('entries')
        .select('ip_country_code, anxiety_score')
        .gte('created_at', sinceYesterday)
        .not('ip_country_code', 'is', null)
        .not('anxiety_score', 'is', null),
      supabase
        .from('coherence_snapshots')
        .select('current_coherence')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { count: newMatchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceYesterday);

    const zoneStats: Record<string, { total: number; count: number }> = {};
    (hotZoneRows || []).forEach((row) => {
      const iso = String(row.ip_country_code || '').toUpperCase();
      if (!iso) return;
      if (!zoneStats[iso]) zoneStats[iso] = { total: 0, count: 0 };
      zoneStats[iso].total += Number(row.anxiety_score || 0);
      zoneStats[iso].count += 1;
    });
    const topHotZone = Object.entries(zoneStats)
      .map(([iso, v]) => ({ iso, avgAnxiety: v.count ? Math.round((v.total / v.count) * 10) / 10 : 0 }))
      .sort((a, b) => b.avgAnxiety - a.avgAnxiety)[0] || null;

    return NextResponse.json({
      globalCoherence: coherence ? Math.round(Number(coherence.current_coherence || 0) * 1000) / 1000 : null,
      streakCount: Number(profile?.streak_count || 0),
      yesterdayEntry: latestEntry
        ? {
            id: latestEntry.id,
            analyzed: Boolean(latestEntry.ai_analyzed_at),
            summary: latestEntry.ai_summary || latestEntry.content?.slice(0, 120) || '',
          }
        : null,
      platformMatches: {
        count: Number(newMatchesCount || 0),
        top: topMatch
          ? {
              id: topMatch.id,
              title: topMatch.event_title || '',
              score: Number(topMatch.similarity_score || 0),
              eventDate: topMatch.event_date || null,
            }
          : null,
      },
      hotZone: topHotZone,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('morning-digest GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
