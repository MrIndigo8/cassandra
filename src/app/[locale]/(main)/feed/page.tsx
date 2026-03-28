import { createAdminClient } from '@/lib/supabase/server';
import { FeedClient } from './FeedClient';
import type { FeedEntry } from '@/components/EntryCard';
import { getMatchesForEntries } from '@/lib/matches';
import { isFeatureEnabled } from '@/lib/features';
import { FeatureDisabled } from '@/components/FeatureDisabled';
import { parseFeedFilterParam, typesForFeedFilter } from '@/lib/feed/feedFilters';

// Force dynamic so that the feed is always fresh on load
export const dynamic = 'force-dynamic';

const ENTRY_SELECT_FULL = `
  id, type, title, content, image_url, is_verified, best_match_score,
  view_count, prediction_potential, user_insight, sensory_data, created_at,
  users:user_id (id, username, avatar_url, role, rating_score)
`;

const ENTRY_SELECT_FALLBACK = `
  id, type, title, content, image_url, is_verified, best_match_score,
  view_count, created_at,
  users:user_id (id, username, avatar_url, role, rating_score)
`;

const ENTRY_SELECT_MINIMAL = `
  id, type, title, content, image_url, is_verified, best_match_score,
  view_count, created_at, user_id
`;

type FeedPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  if (!(await isFeatureEnabled('feed'))) {
    return <FeatureDisabled navKey="feed" />;
  }

  const initialFilter = parseFeedFilterParam(searchParams.filter);
  const typeList = typesForFeedFilter(initialFilter);

  // Use admin client for public feed bootstrap to avoid RLS/session edge-cases.
  const supabase = createAdminClient();

  let entries:
    | Array<Record<string, unknown>>
    | null = null;
  let error: { message?: string } | null = null;

  let fullQ = supabase
    .from('entries')
    .select(ENTRY_SELECT_FULL)
    .or('is_public.is.null,is_public.eq.true')
    .order('created_at', { ascending: false });
  if (typeList) fullQ = fullQ.in('type', typeList);
  const fullQuery = await fullQ.range(0, 19);
  entries = fullQuery.data as Array<Record<string, unknown>> | null;
  error = fullQuery.error;

  if (error) {
    let fbQ = supabase
      .from('entries')
      .select(ENTRY_SELECT_FALLBACK)
      .or('is_public.is.null,is_public.eq.true')
      .order('created_at', { ascending: false });
    if (typeList) fbQ = fbQ.in('type', typeList);
    const fallbackQuery = await fbQ.range(0, 19);
    entries = fallbackQuery.data as Array<Record<string, unknown>> | null;
    error = fallbackQuery.error;
  }

  if (error) {
    let minQ = supabase
      .from('entries')
      .select(ENTRY_SELECT_MINIMAL)
      .or('is_public.is.null,is_public.eq.true')
      .order('created_at', { ascending: false });
    if (typeList) minQ = minQ.in('type', typeList);
    const minimalQuery = await minQ.range(0, 19);
    entries = minimalQuery.data as Array<Record<string, unknown>> | null;
    error = minimalQuery.error;
  }

  if (error) {
    console.error('Ошибка загрузки ленты на сервере:', error);
  }

  const baseEntries = ((entries || []) as unknown as Array<{
    id: string;
    type: string;
    title: string | null;
    content: string;
    image_url: string | null;
    is_verified: boolean | null;
    best_match_score: number | null;
    view_count: number | null;
    prediction_potential?: number | null;
    user_insight?: string | null;
    sensory_data?: {
      sensory_patterns?: Array<{ sensation?: string }>;
      verification_keywords?: string[];
    } | null;
    created_at: string;
    user_id?: string;
    users: {
      id: string;
      username: string;
      avatar_url: string | null;
      role: string | null;
      rating_score: number | null;
    } | {
      id: string;
      username: string;
      avatar_url: string | null;
      role: string | null;
      rating_score: number | null;
    }[] | null;
  }>);

  const entryIds = baseEntries.map((e) => e.id);
  const likesCountByEntry = new Map<string, number>();
  const commentsCountByEntry = new Map<string, number>();
  const communityCountByEntry = new Map<string, number>();
  const likedByCurrentUser = new Set<string>();

  if (entryIds.length > 0) {
    const [
      { data: likesRows },
      { data: commentsRows },
      { data: communityRows },
      {
        data: { user },
      },
    ] = await Promise.all([
      supabase
        .from('reactions')
        .select('entry_id')
        .eq('emoji', 'like')
        .in('entry_id', entryIds),
      supabase
        .from('comments')
        .select('entry_id')
        .in('entry_id', entryIds),
      supabase
        .from('community_confirmations')
        .select('entry_id')
        .in('entry_id', entryIds),
      supabase.auth.getUser(),
    ]);

    likesRows?.forEach((row: { entry_id: string }) => {
      likesCountByEntry.set(row.entry_id, (likesCountByEntry.get(row.entry_id) || 0) + 1);
    });
    commentsRows?.forEach((row: { entry_id: string }) => {
      commentsCountByEntry.set(row.entry_id, (commentsCountByEntry.get(row.entry_id) || 0) + 1);
    });
    communityRows?.forEach((row: { entry_id: string }) => {
      communityCountByEntry.set(row.entry_id, (communityCountByEntry.get(row.entry_id) || 0) + 1);
    });

    if (user) {
      const { data: likedRows } = await supabase
        .from('reactions')
        .select('entry_id')
        .eq('user_id', user.id)
        .eq('emoji', 'like')
        .in('entry_id', entryIds);

      likedRows?.forEach((row) => likedByCurrentUser.add(row.entry_id));
    }
  }

  const initialEntries: FeedEntry[] = baseEntries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    content: entry.content,
    image_url: entry.image_url,
    is_verified: Boolean(entry.is_verified),
    best_match_score: entry.best_match_score,
    view_count: entry.view_count ?? 0,
    prediction_potential: entry.prediction_potential ?? null,
    user_insight: entry.user_insight ?? null,
    sensory_data: entry.sensory_data ?? null,
    created_at: entry.created_at,
    user: {
      id: (Array.isArray(entry.users) ? entry.users[0]?.id : entry.users?.id) || entry.user_id || '',
      username: (Array.isArray(entry.users) ? entry.users[0]?.username : entry.users?.username) || 'anonymous',
      avatar_url: (Array.isArray(entry.users) ? entry.users[0]?.avatar_url : entry.users?.avatar_url) || null,
      role: (Array.isArray(entry.users) ? entry.users[0]?.role : entry.users?.role) || 'observer',
      rating_score: Number((Array.isArray(entry.users) ? entry.users[0]?.rating_score : entry.users?.rating_score) || 0),
    },
    likes_count: likesCountByEntry.get(entry.id) || 0,
    comments_count: commentsCountByEntry.get(entry.id) || 0,
    community_count: communityCountByEntry.get(entry.id) || 0,
    user_liked: likedByCurrentUser.has(entry.id),
  }));

  const verifiedIds = initialEntries
    .filter((entry) => entry.is_verified && (entry.best_match_score || 0) > 0.6)
    .map((entry) => entry.id);
  const matches = verifiedIds.length > 0 ? await getMatchesForEntries(verifiedIds, supabase) : [];
  const matchByEntry = new Map(matches.map((m) => [m.entry_id, m]));
  const enrichedEntries = initialEntries.map((entry) => ({
    ...entry,
    match: matchByEntry.get(entry.id) || null,
  }));

  return <FeedClient initialEntries={enrichedEntries} initialFilter={initialFilter} />;
}

