import { createServerSupabaseClient } from '@/lib/supabase/server';

type MatchEntryUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string | null;
  rating_score: number | null;
};

type MatchEntry = {
  id: string;
  title: string | null;
  content: string;
  type: string;
  ai_images: string[] | null;
  ai_summary: string | null;
  created_at: string;
  users: MatchEntryUser | MatchEntryUser[] | null;
};

type MatchRow = {
  id: string;
  similarity_score: number;
  matched_symbols: string[] | null;
  verification_status: string | null;
  created_at: string;
  event_title: string;
  event_description: string | null;
  event_url: string | null;
  event_date: string;
  entries: MatchEntry | MatchEntry[] | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 10)));
  const userOnly = searchParams.get('user_only') === 'true';
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from('matches')
    .select(`
      id, event_title, event_description, event_url, event_date,
      similarity_score, matched_symbols, verification_status, created_at,
      entries:entry_id (
        id, title, content, type, ai_images, ai_summary, created_at,
        users:user_id (id, username, avatar_url, role, rating_score)
      )
    `)
    .gt('similarity_score', 0.6)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userOnly) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      return Response.json({ matches: [] });
    }
  }

  const { data } = await query;
  const rows = (data || []) as MatchRow[];

  return Response.json({
    matches: rows.map((row) => {
      const entryData = Array.isArray(row.entries) ? row.entries[0] : row.entries;
      const entryUser = Array.isArray(entryData?.users) ? entryData?.users[0] : entryData?.users;

      return {
        id: row.id,
        similarity_score: row.similarity_score,
        matched_symbols: row.matched_symbols || [],
        event: {
          title: row.event_title,
          description: row.event_description,
          url: row.event_url,
          date: row.event_date,
        },
        entry: entryData
          ? {
              id: entryData.id,
              title: entryData.title,
              content: entryData.content,
              type: entryData.type,
              ai_summary: entryData.ai_summary,
              created_at: entryData.created_at,
              user: entryUser
                ? {
                    username: entryUser.username,
                    avatar_url: entryUser.avatar_url,
                    role: entryUser.role || 'observer',
                    rating_score: Number(entryUser.rating_score || 0),
                  }
                : null,
            }
          : null,
        created_at: row.created_at,
      };
    }),
  });
}
