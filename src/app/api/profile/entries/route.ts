import { NextResponse } from 'next/server';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { getMatchesForEntries, bestMatchPerEntry } from '@/lib/matches';
import type { FeedEntry } from '@/components/EntryCard';

export async function GET(req: Request) {
  const authSb = createServerSupabaseClient();
  const db = createAdminClient();
  const url = new URL(req.url);
  const username = url.searchParams.get('username');
  const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 });
  }

  const {
    data: { user: currentUser },
  } = await authSb.auth.getUser();

  const { data: profile, error: profileError } = await authSb
    .from('users')
    .select('id, username, avatar_url, role, rating_score, is_public')
    .eq('username', username)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwnProfile = currentUser?.id === profile.id;
  if (!isOwnProfile && profile.is_public === false) {
    let isAdmin = false;
    if (currentUser) {
      const { data: me } = await authSb.from('users').select('role').eq('id', currentUser.id).single();
      isAdmin = ['architect', 'admin'].includes(String(me?.role || ''));
    }
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let q = db
    .from('entries')
    .select(
      'id, type, title, content, image_url, is_verified, best_match_score, view_count, prediction_potential, sensory_data, created_at'
    )
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!isOwnProfile) {
    q = q.or('is_public.eq.true,is_public.is.null');
  }

  const { data: entries, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = entries || [];
  const entryIds = rows.map((e) => e.id);
  const likesMap: Record<string, number> = {};
  const commentsMap: Record<string, number> = {};
  const userLikedMap: Record<string, boolean> = {};

  if (entryIds.length > 0) {
    const [{ data: likes }, { data: comments }] = await Promise.all([
      db.from('reactions').select('entry_id').in('entry_id', entryIds).eq('emoji', 'like'),
      db.from('comments').select('entry_id').in('entry_id', entryIds),
    ]);
    for (const l of likes || []) {
      likesMap[l.entry_id] = (likesMap[l.entry_id] || 0) + 1;
    }
    for (const c of comments || []) {
      commentsMap[c.entry_id] = (commentsMap[c.entry_id] || 0) + 1;
    }
    if (currentUser) {
      const { data: myLikes } = await db
        .from('reactions')
        .select('entry_id')
        .in('entry_id', entryIds)
        .eq('user_id', currentUser.id)
        .eq('emoji', 'like');
      for (const l of myLikes || []) {
        userLikedMap[l.entry_id] = true;
      }
    }
  }

  const verifiedIds = rows
    .filter((e) => e.is_verified && e.best_match_score && e.best_match_score > 0.6)
    .map((e) => e.id);
  const rawEntryMatches = verifiedIds.length > 0 ? await getMatchesForEntries(verifiedIds, db) : [];
  const bestMap = bestMatchPerEntry(rawEntryMatches);

  const feedEntries: FeedEntry[] = rows.map((e) => {
    const id = e.id;
    const m = bestMap.get(id) || null;
    return {
      id,
      type: String(e.type || 'unknown'),
      title: e.title,
      content: String(e.content || ''),
      image_url: e.image_url,
      is_verified: Boolean(e.is_verified),
      best_match_score: e.best_match_score,
      view_count: Number(e.view_count || 0),
      prediction_potential: e.prediction_potential ?? null,
      sensory_data: e.sensory_data ?? null,
      created_at: e.created_at,
      user: {
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        role: profile.role || 'observer',
        rating_score: Number(profile.rating_score || 0),
      },
      likes_count: likesMap[id] || 0,
      comments_count: commentsMap[id] || 0,
      user_liked: userLikedMap[id] || false,
      match: m,
    };
  });

  return NextResponse.json({
    entries: feedEntries,
    hasMore: rows.length >= limit,
  });
}
