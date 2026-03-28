import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: totalMatches },
      { count: weeklyMatches },
      { data: topMatchesRaw },
      { data: realitySnap },
      { data: coherenceSnap },
    ] = await Promise.all([
      admin.from('users').select('*', { count: 'exact', head: true }),
      admin.from('matches').select('*', { count: 'exact', head: true }).gt('similarity_score', 0.6),
      admin
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .gt('similarity_score', 0.6)
        .gte('created_at', weekAgo),
      admin
        .from('matches')
        .select(`
            id, similarity_score, event_title, event_date,
            entries:entry_id (id, content, ai_summary, users:user_id(username))
          `)
        .gt('similarity_score', 0.6)
        .order('similarity_score', { ascending: false })
        .limit(3),
      admin
        .from('reality_snapshots')
        .select('coherence_index')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('coherence_snapshots')
        .select('current_coherence')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    type TopMatchRow = {
      id: string;
      similarity_score: number | null;
      event_title: string | null;
      event_date: string | null;
      entries:
        | {
            id: string;
            content: string | null;
            ai_summary: string | null;
            users: { username: string | null } | Array<{ username: string | null }> | null;
          }
        | Array<{
            id: string;
            content: string | null;
            ai_summary: string | null;
            users: { username: string | null } | Array<{ username: string | null }> | null;
          }>
        | null;
    };
    const topMatches = ((topMatchesRaw || []) as TopMatchRow[]).map((m) => {
      const entry = Array.isArray(m.entries) ? m.entries[0] : m.entries;
      const user = Array.isArray(entry?.users) ? entry.users[0] : entry?.users;
      return {
        id: m.id,
        score: Number(m.similarity_score || 0),
        eventTitle: m.event_title || '',
        eventDate: m.event_date || null,
        quote: entry?.ai_summary || entry?.content?.slice(0, 140) || '',
        username: user?.username || 'anonymous',
      };
    });

    const fromReality = realitySnap?.coherence_index;
    const fromCoherence = coherenceSnap?.current_coherence;
    const globalCoherence =
      typeof fromReality === 'number' && !Number.isNaN(fromReality)
        ? fromReality
        : typeof fromCoherence === 'number' && !Number.isNaN(fromCoherence)
          ? fromCoherence
          : null;

    return NextResponse.json({
      totalUsers: Number(totalUsers || 0),
      totalMatches: Number(totalMatches || 0),
      weeklyMatches: Number(weeklyMatches || 0),
      globalCoherence,
      topMatches,
    });
  } catch (error) {
    console.error('landing-stats GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
