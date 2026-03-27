'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { EntryCard, type FeedEntry } from '@/components/EntryCard';
import { InlineEntryForm } from '@/components/InlineEntryForm';
import { PushBanner } from '@/components/PushBanner';
import MorningDigestBanner from '@/components/MorningDigestBanner';
import { useTranslations } from 'next-intl';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import type { Entry, User } from '@/types';
import { getMatchesForEntries } from '@/lib/matches';

type BaseEntryRow = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  image_url: string | null;
  is_verified: boolean | null;
  best_match_score: number | null;
  view_count: number | null;
  prediction_potential: number | null;
  sensory_data: {
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
};

type FeedStatsResponse = {
  likesCount: Record<string, number>;
  commentsCount: Record<string, number>;
  communityCount: Record<string, number>;
  userLiked: Record<string, boolean>;
};

const ENTRY_SELECT_FULL = `
  id, type, title, content, image_url, is_verified, best_match_score,
  view_count, prediction_potential, sensory_data, created_at,
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

interface FeedClientProps {
  initialEntries: FeedEntry[];
}

export function FeedClient({ initialEntries }: FeedClientProps) {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialEntries.length === 20); // Зависит от PAGE_SIZE
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const [supabase] = useState(() => createClient());
  const { user, profile } = useUser();
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const tf = (key: string, fallback: string) => {
    try {
      return t(key);
    } catch {
      return fallback;
    }
  };

  const fetchEntriesWithFallback = useCallback(
    async (options: { from?: number; to?: number; limit?: number; entryId?: string }) => {
      let query = supabase
        .from('entries')
        .select(ENTRY_SELECT_FULL)
        .or('is_public.is.null,is_public.eq.true')
        .order('created_at', { ascending: false });

      if (options.entryId) query = query.eq('id', options.entryId);
      if (typeof options.from === 'number' && typeof options.to === 'number') query = query.range(options.from, options.to);
      if (typeof options.limit === 'number') query = query.limit(options.limit);

      const primary = await query;
      if (!primary.error) {
        return primary.data as BaseEntryRow[] | null;
      }

      let fallbackQuery = supabase
        .from('entries')
        .select(ENTRY_SELECT_FALLBACK)
        .or('is_public.is.null,is_public.eq.true')
        .order('created_at', { ascending: false });

      if (options.entryId) fallbackQuery = fallbackQuery.eq('id', options.entryId);
      if (typeof options.from === 'number' && typeof options.to === 'number') fallbackQuery = fallbackQuery.range(options.from, options.to);
      if (typeof options.limit === 'number') fallbackQuery = fallbackQuery.limit(options.limit);

      const fallback = await fallbackQuery;
      if (!fallback.error) {
        return fallback.data as BaseEntryRow[] | null;
      }

      let minimalQuery = supabase
        .from('entries')
        .select(ENTRY_SELECT_MINIMAL)
        .or('is_public.is.null,is_public.eq.true')
        .order('created_at', { ascending: false });

      if (options.entryId) minimalQuery = minimalQuery.eq('id', options.entryId);
      if (typeof options.from === 'number' && typeof options.to === 'number') minimalQuery = minimalQuery.range(options.from, options.to);
      if (typeof options.limit === 'number') minimalQuery = minimalQuery.limit(options.limit);

      const minimal = await minimalQuery;
      if (minimal.error) throw minimal.error;
      return minimal.data as BaseEntryRow[] | null;
    },
    [supabase]
  );

  const hydrateEntries = useCallback(async (baseRows: BaseEntryRow[]): Promise<FeedEntry[]> => {
    const entryIds = baseRows.map((e) => e.id);
    if (entryIds.length === 0) return [];
    let likesCountMap: Record<string, number> = {};
    let commentsCountMap: Record<string, number> = {};
    let communityCountMap: Record<string, number> = {};
    let userLikedMap: Record<string, boolean> = {};

    try {
      const statsRes = await fetch('/api/feed/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: entryIds }),
      });

      if (!statsRes.ok) {
        throw new Error('feed_stats_failed');
      }

      const stats = (await statsRes.json()) as FeedStatsResponse;
      likesCountMap = stats.likesCount || {};
      commentsCountMap = stats.commentsCount || {};
      communityCountMap = stats.communityCount || {};
      userLikedMap = stats.userLiked || {};
    } catch {
      // Safe fallback to previous client-side batch queries.
      const [likesRes, commentsRes, likedRes, communityRes] = await Promise.all([
        supabase
          .from('reactions')
          .select('entry_id')
          .eq('emoji', 'like')
          .in('entry_id', entryIds),
        supabase
          .from('comments')
          .select('entry_id')
          .in('entry_id', entryIds),
        user
          ? supabase
              .from('reactions')
              .select('entry_id')
              .eq('user_id', user.id)
              .eq('emoji', 'like')
              .in('entry_id', entryIds)
          : Promise.resolve({ data: [] as Array<{ entry_id: string }> }),
        supabase
          .from('community_confirmations')
          .select('entry_id')
          .in('entry_id', entryIds),
      ]);

      likesRes.data?.forEach((row: { entry_id: string }) => {
        likesCountMap[row.entry_id] = (likesCountMap[row.entry_id] || 0) + 1;
      });
      commentsRes.data?.forEach((row: { entry_id: string }) => {
        commentsCountMap[row.entry_id] = (commentsCountMap[row.entry_id] || 0) + 1;
      });
      likedRes.data?.forEach((row: { entry_id: string }) => {
        userLikedMap[row.entry_id] = true;
      });
      communityRes.data?.forEach((row: { entry_id: string }) => {
        communityCountMap[row.entry_id] = (communityCountMap[row.entry_id] || 0) + 1;
      });
    }

    return baseRows.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      image_url: entry.image_url,
      is_verified: Boolean(entry.is_verified),
      best_match_score: entry.best_match_score,
      view_count: entry.view_count ?? 0,
      prediction_potential: entry.prediction_potential ?? null,
      sensory_data: entry.sensory_data ?? null,
      created_at: entry.created_at,
      user: {
        id: (Array.isArray(entry.users) ? entry.users[0]?.id : entry.users?.id) || entry.user_id || '',
        username: (Array.isArray(entry.users) ? entry.users[0]?.username : entry.users?.username) || 'anonymous',
        avatar_url: (Array.isArray(entry.users) ? entry.users[0]?.avatar_url : entry.users?.avatar_url) || null,
        role: (Array.isArray(entry.users) ? entry.users[0]?.role : entry.users?.role) || 'observer',
        rating_score: Number((Array.isArray(entry.users) ? entry.users[0]?.rating_score : entry.users?.rating_score) || 0),
      },
      likes_count: likesCountMap[entry.id] || 0,
      comments_count: commentsCountMap[entry.id] || 0,
      user_liked: Boolean(userLikedMap[entry.id]),
      community_count: communityCountMap[entry.id] || 0,
    })).map((entry) => ({ ...entry, match: null }));
  }, [supabase, user]);

  const appendSingleEntry = useCallback(async (entryId: string) => {
    const data = await fetchEntriesWithFallback({ entryId, limit: 1 });
    const row = data?.[0];
    if (!row) return;
    const hydrated = await hydrateEntries([row]);
    if (!hydrated.length) return;
    setEntries((prev) => {
      if (prev.some((e) => e.id === entryId)) return prev;
      return [hydrated[0], ...prev];
    });
  }, [fetchEntriesWithFallback, hydrateEntries]);

  // Supabase Realtime подписка
  useEffect(() => {
    const channel = supabase
      .channel('public:entries')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entries',
          filter: 'is_public=eq.true', // Слушаем только публичные вставки
        },
        async (payload: RealtimePostgresInsertPayload<Entry>) => {
          const newEntry = payload.new;
          
          let userData = null;

          // Оптимизация N+1: если это наша запись, берем данные из профиля
          if (user && profile && newEntry.user_id === user.id) {
            userData = {
              id: user.id,
              username: profile.username,
              avatar_url: profile.avatar_url,
              role: (profile as User & { role?: string }).role || 'observer',
              rating_score: Number((profile as User & { rating_score?: number }).rating_score || 0),
            };
          } else {
            // Иначе делаем запрос (один)
            const { data } = await supabase
              .from('users')
              .select('id, username, avatar_url, role, rating_score')
              .eq('id', newEntry.user_id)
              .single();
            userData = data;
          }

          const fullEntry: FeedEntry = {
            id: newEntry.id,
            type: newEntry.type,
            title: newEntry.title,
            content: newEntry.content,
            image_url: newEntry.image_url || null,
            is_verified: Boolean((newEntry as Entry & { is_verified?: boolean }).is_verified),
            best_match_score: (newEntry as Entry & { best_match_score?: number | null }).best_match_score ?? null,
            view_count: (newEntry as Entry & { view_count?: number | null }).view_count ?? 0,
            prediction_potential: (newEntry as Entry & { prediction_potential?: number | null }).prediction_potential ?? null,
            sensory_data: (newEntry as Entry & { sensory_data?: BaseEntryRow['sensory_data'] }).sensory_data ?? null,
            created_at: newEntry.created_at,
            user: {
              id: userData?.id || newEntry.user_id,
              username: userData?.username || 'anonymous',
              avatar_url: userData?.avatar_url || null,
              role: userData?.role || 'observer',
              rating_score: Number(userData?.rating_score || 0),
            },
            likes_count: 0,
            comments_count: 0,
            user_liked: false,
            community_count: 0,
          };

          // Добавляем в начало списка с дедупликацией
          setEntries((prev) => {
            if (prev.some(e => e.id === fullEntry.id)) return prev;
            return [fullEntry, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, profile]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ entryId?: string }>).detail;
      if (!detail?.entryId) return;
      void appendSingleEntry(detail.entryId);
    };
    window.addEventListener('entry:created', handler);
    return () => window.removeEventListener('entry:created', handler);
  }, [appendSingleEntry]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const data = await fetchEntriesWithFallback({ from, to });

      if (data) {
        const hydrated = await hydrateEntries(data as BaseEntryRow[]);
        const verifiedIds = hydrated
          .filter((entry) => entry.is_verified && (entry.best_match_score || 0) > 0.6)
          .map((entry) => entry.id);
        const matches = verifiedIds.length ? await getMatchesForEntries(verifiedIds, supabase) : [];
        const matchByEntry = new Map(matches.map((m) => [m.entry_id, m]));
        const hydratedWithMatches = hydrated.map((entry) => ({
          ...entry,
          match: matchByEntry.get(entry.id) || null,
        }));

        setEntries((prev) => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries = hydratedWithMatches.filter(e => !existingIds.has(e.id));
          return [...prev, ...newEntries];
        });
        setPage((prev) => prev + 1);
        setHasMore(hydrated.length === PAGE_SIZE);
      }
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки ленты:', err);
      setError(tCommon('errors.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const reloadFeed = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    try {
      const dataSafe = await fetchEntriesWithFallback({ limit: PAGE_SIZE });
      const hydrated = await hydrateEntries((dataSafe || []) as BaseEntryRow[]);
      const verifiedIds = hydrated
        .filter((entry) => entry.is_verified && (entry.best_match_score || 0) > 0.6)
        .map((entry) => entry.id);
      const matches = verifiedIds.length ? await getMatchesForEntries(verifiedIds, supabase) : [];
      const matchByEntry = new Map(matches.map((m) => [m.entry_id, m]));
      const hydratedWithMatches = hydrated.map((entry) => ({
        ...entry,
        match: matchByEntry.get(entry.id) || null,
      }));
      setEntries(hydratedWithMatches);
      setHasMore(hydratedWithMatches.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      console.error('Ошибка перезагрузки ленты:', err);
      setError(tCommon('errors.generic'));
    }
  }, [fetchEntriesWithFallback, hydrateEntries, supabase, tCommon]);

  useEffect(() => {
    if (initialEntries.length === 0) {
      void reloadFeed();
    }
  }, [initialEntries.length, reloadFeed]);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="space-y-6">
        {/* Баннер утренних напоминаний */}
        <MorningDigestBanner />
        <PushBanner />

        {/* Форма публикации сигнала */}
        <InlineEntryForm />
      </div>

      {/* Пустое состояние или Ошибка */}
      {error && !loadingMore && entries.length === 0 ? (
        <div className="card glass text-center py-20 px-6 flex flex-col items-center border-border">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => reloadFeed()} className="px-6 py-2 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors">
            {tCommon('errors.tryAgain')}
          </button>
        </div>
      ) : entries.length > 0 ? (
        <div className="flex flex-col gap-5 mt-8">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={{
                id: entry.id,
                type: entry.type,
                title: entry.title,
                content: entry.content,
                image_url: entry.image_url || null,
                is_verified: entry.is_verified,
                best_match_score: entry.best_match_score,
                view_count: entry.view_count ?? 0,
                prediction_potential: entry.prediction_potential ?? null,
                sensory_data: entry.sensory_data ?? null,
                created_at: entry.created_at,
              }}
              user={{
                id: entry.user.id,
                username: entry.user.username || 'anonymous',
                avatar_url: entry.user.avatar_url || null,
                role: entry.user.role || 'observer',
                rating_score: Number(entry.user.rating_score || 0),
              }}
              likes_count={entry.likes_count ?? 0}
              comments_count={entry.comments_count ?? 0}
              user_liked={Boolean(entry.user_liked)}
              community_count={entry.community_count ?? 0}
              match={entry.match || null}
            />
          ))}
        </div>
      ) : (
        /* Пустое состояние */
        <div className="card glass text-center py-20 px-6 flex flex-col items-center border-border">
          <div className="w-24 h-24 rounded-full bg-surface border-border flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping-slow"></div>
            <svg className="w-10 h-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-3 line-clamp-2 md:line-clamp-none">
            {tf('empty', t('emptyAll'))}
          </h2>
        </div>
      )}

      {/* Кнопка "Загрузить ещё" или Ошибка пагинации */}
      {entries.length > 0 && hasMore && (
        <div className="mt-12 text-center flex flex-col items-center gap-4">
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-8 py-3 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50 font-medium"
          >
            {loadingMore ? tCommon('loading') : error ? tCommon('errors.tryAgain') : tf('loadMore', t('loadMore'))}
          </button>
        </div>
      )}
      {loadingMore && (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border p-5">
              <div className="h-4 w-1/3 skeleton mb-3" />
              <div className="h-3 w-full skeleton mb-2" />
              <div className="h-3 w-5/6 skeleton mb-2" />
              <div className="h-3 w-2/3 skeleton" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
