import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: totalUsers }, { count: totalMatches }, { count: weeklyMatches }, { data: topMatchesRaw }] =
      await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).gt('similarity_score', 0.6),
        supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .gt('similarity_score', 0.6)
          .gte('created_at', weekAgo),
        supabase
          .from('matches')
          .select(`
            id, similarity_score, event_title, event_date,
            entries:entry_id (id, content, ai_summary, users:user_id(username))
          `)
          .gt('similarity_score', 0.6)
          .order('similarity_score', { ascending: false })
          .limit(3),
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

    return NextResponse.json({
      totalUsers: Number(totalUsers || 0),
      totalMatches: Number(totalMatches || 0),
      weeklyMatches: Number(weeklyMatches || 0),
      globalCoherence: null,
      topMatches,
    });
  } catch (error) {
    console.error('landing-stats GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
