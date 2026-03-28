import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import ProfileClient from './ProfileClient';
import { getMatchesForEntries, parseMatchRow, bestMatchPerEntry } from '@/lib/matches';
import { getProgressToNextRole } from '@/lib/scoring';
import type { FeedEntry } from '@/components/EntryCard';

export const dynamic = 'force-dynamic';

type UserRow = {
  id: string;
  username: string;
  full_name: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  is_public: boolean | null;
  role: string | null;
  rating_score: number | null;
  verified_count: number | null;
  total_entries: number | null;
  total_matches: number | null;
  streak_count: number | null;
  streak: number | null;
  avg_specificity: number | null;
  avg_lag_days: number | null;
  dominant_images: string[] | null;
  created_at: string;
};

export async function generateMetadata({
  params,
}: {
  params: { locale: string; username: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'profile' });
  return {
    title: `@${params.username} — ${t('metaTitle')}`,
    description: `@${params.username}`,
  };
}

async function PrivateProfileBlock({ username, locale }: { username: string; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'profile' });
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center text-3xl mb-4">🔒</div>
      <h2 className="text-xl font-bold text-text-primary mb-2">@{username}</h2>
      <p className="text-text-secondary">{t('privateProfile')}</p>
    </div>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: { locale: string; username: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase.from('users').select('*').eq('username', params.username).single();

  if (error || !profile) notFound();

  const p = profile as UserRow;

  const isOwnProfile = currentUser?.id === p.id;

  if (!isOwnProfile && p.is_public === false) {
    let isAdmin = false;
    if (currentUser) {
      const { data: me } = await supabase.from('users').select('role').eq('id', currentUser.id).single();
      isAdmin = ['architect', 'admin'].includes(String(me?.role || ''));
    }
    if (!isAdmin) {
      return <PrivateProfileBlock username={params.username} locale={params.locale} />;
    }
  }

  let entriesQuery = supabase
    .from('entries')
    .select(
      'id, type, title, content, image_url, is_verified, best_match_score, view_count, anxiety_score, threat_type, created_at, scope, prediction_potential, sensory_data, is_public'
    )
    .eq('user_id', p.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!isOwnProfile) {
    entriesQuery = entriesQuery.eq('is_public', true);
  }

  const { data: entries } = await entriesQuery;

  const { data: matchesRaw } = await supabase
    .from('matches')
    .select('*')
    .eq('user_id', p.id)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false })
    .limit(5);

  const matchRows = (matchesRaw || []) as Record<string, unknown>[];
  const matchesForClient = matchRows.map(parseMatchRow);

  const entryIdsForMatches = Array.from(new Set(matchesForClient.map((m) => m.entry_id)));

  type MatchEntryMap = Record<
    string,
    {
      id: string;
      title: string | null;
      content: string;
      type: string;
      created_at: string;
      user?: {
        username: string;
        avatar_url: string | null;
        role: string;
        rating_score: number;
      };
    }
  >;

  const entryById: MatchEntryMap = {};

  if (entryIdsForMatches.length > 0) {
    const { data: entryRows } = await supabase
      .from('entries')
      .select('id, title, content, type, created_at, user_id, users:user_id (username, avatar_url, role, rating_score)')
      .in('id', entryIdsForMatches);

    for (const row of entryRows || []) {
      const r = row as Record<string, unknown>;
      const users = r.users as Record<string, unknown> | Record<string, unknown>[] | null;
      const u = Array.isArray(users) ? users[0] : users;
      entryById[String(r.id)] = {
        id: String(r.id),
        title: (r.title as string | null) ?? null,
        content: String(r.content || ''),
        type: String(r.type || 'unknown'),
        created_at: String(r.created_at || ''),
        user: u
          ? {
              username: String(u.username || ''),
              avatar_url: (u.avatar_url as string | null) ?? null,
              role: String(u.role || 'observer'),
              rating_score: Number(u.rating_score || 0),
            }
          : undefined,
      };
    }
  }

  const verifiedIds = (entries || [])
    .filter((e) => e.is_verified && e.best_match_score && e.best_match_score > 0.6)
    .map((e) => e.id);
  const rawEntryMatches = verifiedIds.length > 0 ? await getMatchesForEntries(verifiedIds, supabase) : [];
  const bestMap = bestMatchPerEntry(rawEntryMatches);

  const entryIds = (entries || []).map((e) => e.id);
  const likesMap: Record<string, number> = {};
  const commentsMap: Record<string, number> = {};
  const userLikedMap: Record<string, boolean> = {};

  if (entryIds.length > 0) {
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from('reactions').select('entry_id').in('entry_id', entryIds).eq('emoji', 'like'),
      supabase.from('comments').select('entry_id').in('entry_id', entryIds),
    ]);
    for (const l of likes || []) {
      likesMap[l.entry_id] = (likesMap[l.entry_id] || 0) + 1;
    }
    for (const c of comments || []) {
      commentsMap[c.entry_id] = (commentsMap[c.entry_id] || 0) + 1;
    }
    if (currentUser) {
      const { data: myLikes } = await supabase
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

  const nextRole = getProgressToNextRole(
    Number(p.rating_score || 0),
    Number(p.verified_count || 0),
    Number(p.total_entries || 0),
    String(p.role || 'observer')
  );

  const { data: typeStats } = await supabase.from('entries').select('type').eq('user_id', p.id);

  const typeCounts: Record<string, number> = {};
  for (const e of typeStats || []) {
    const typ = (e as { type: string }).type;
    typeCounts[typ] = (typeCounts[typ] || 0) + 1;
  }

  const streak = Number(p.streak_count ?? p.streak ?? 0);

  const feedEntries: FeedEntry[] = (entries || []).map((e) => {
    const row = e as Record<string, unknown>;
    const id = String(row.id);
    const m = bestMap.get(id) || null;
    return {
      id,
      type: String(row.type || 'unknown'),
      title: (row.title as string | null) ?? null,
      content: String(row.content || ''),
      image_url: (row.image_url as string | null) ?? null,
      is_verified: Boolean(row.is_verified),
      best_match_score: (row.best_match_score as number | null) ?? null,
      view_count: Number(row.view_count || 0),
      prediction_potential: (row.prediction_potential as number | null) ?? null,
      sensory_data: (row.sensory_data as FeedEntry['sensory_data']) ?? null,
      created_at: String(row.created_at || ''),
      user: {
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        role: p.role || 'observer',
        rating_score: Number(p.rating_score || 0),
      },
      likes_count: likesMap[id] || 0,
      comments_count: commentsMap[id] || 0,
      user_liked: userLikedMap[id] || false,
      match: m,
    };
  });

  return (
    <ProfileClient
      locale={params.locale}
      profileUsername={params.username}
      profile={{
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        display_name: p.display_name,
        bio: p.bio,
        avatar_url: p.avatar_url,
        location: p.location,
        is_public: p.is_public !== false,
        role: p.role || 'observer',
        rating_score: Number(p.rating_score || 0),
        verified_count: Number(p.verified_count || 0),
        total_entries: Number(p.total_entries || 0),
        total_matches: Number(p.total_matches || 0),
        streak_count: streak,
        avg_specificity: p.avg_specificity,
        avg_lag_days: p.avg_lag_days,
        dominant_images: p.dominant_images,
        created_at: p.created_at,
      }}
      entries={feedEntries}
      matches={matchesForClient}
      matchEntries={entryById}
      nextRole={nextRole}
      typeCounts={typeCounts}
      isOwnProfile={isOwnProfile}
    />
  );
}
