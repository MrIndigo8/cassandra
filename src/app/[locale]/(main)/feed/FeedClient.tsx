'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { EntryCard, type FeedEntry } from '@/components/EntryCard';
import { InlineEntryForm } from '@/components/InlineEntryForm';
import { PushBanner } from '@/components/PushBanner';
import { useTranslations } from 'next-intl';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import type { Entry, User } from '@/types';

type FilterType = 'all' | 'dream' | 'premonition';
type BaseEntryRow = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  image_url: string | null;
  is_verified: boolean | null;
  best_match_score: number | null;
  view_count: number | null;
  created_at: string;
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

interface FeedClientProps {
  initialEntries: FeedEntry[];
}

export function FeedClient({ initialEntries }: FeedClientProps) {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [filter, setFilter] = useState<FilterType>('all');
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

  const hydrateEntries = async (baseRows: BaseEntryRow[]): Promise<FeedEntry[]> => {
    const entryIds = baseRows.map((e) => e.id);
    if (entryIds.length === 0) return [];

    const [likesRes, commentsRes, likedRes] = await Promise.all([
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
    ]);

    const likesCount = new Map<string, number>();
    const commentsCount = new Map<string, number>();
    const likedSet = new Set<string>();

    likesRes.data?.forEach((row: { entry_id: string }) => {
      likesCount.set(row.entry_id, (likesCount.get(row.entry_id) || 0) + 1);
    });

    commentsRes.data?.forEach((row: { entry_id: string }) => {
      commentsCount.set(row.entry_id, (commentsCount.get(row.entry_id) || 0) + 1);
    });

    likedRes.data?.forEach((row: { entry_id: string }) => likedSet.add(row.entry_id));

    return baseRows.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      image_url: entry.image_url,
      is_verified: Boolean(entry.is_verified),
      best_match_score: entry.best_match_score,
      view_count: entry.view_count ?? 0,
      created_at: entry.created_at,
      user: {
        id: (Array.isArray(entry.users) ? entry.users[0]?.id : entry.users?.id) || '',
        username: (Array.isArray(entry.users) ? entry.users[0]?.username : entry.users?.username) || 'anonymous',
        avatar_url: (Array.isArray(entry.users) ? entry.users[0]?.avatar_url : entry.users?.avatar_url) || null,
        role: (Array.isArray(entry.users) ? entry.users[0]?.role : entry.users?.role) || 'observer',
        rating_score: Number((Array.isArray(entry.users) ? entry.users[0]?.rating_score : entry.users?.rating_score) || 0),
      },
      likes_count: likesCount.get(entry.id) || 0,
      comments_count: commentsCount.get(entry.id) || 0,
      user_liked: likedSet.has(entry.id),
    }));
  };

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

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('entries')
        .select(`
          id, type, title, content, image_url, is_verified, best_match_score,
          view_count, created_at,
          users:user_id (id, username, avatar_url, role, rating_score)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const hydrated = await hydrateEntries(data as BaseEntryRow[]);

        setEntries((prev) => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries = hydrated.filter(e => !existingIds.has(e.id));
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

  const handleFilterChange = async (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
    setHasMore(true);
    
    // Загружаем первую страницу с новым фильтром
    try {
      let query = supabase
        .from('entries')
        .select(`
          id, type, title, content, image_url, is_verified, best_match_score,
          view_count, created_at,
          users:user_id (id, username, avatar_url, role, rating_score)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (newFilter !== 'all') {
        query = query.eq('type', newFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const hydrated = await hydrateEntries(data as BaseEntryRow[]);
        setEntries(hydrated);
        setHasMore(hydrated.length === PAGE_SIZE);
      }
      setError(null);
    } catch (err) {
      console.error('Ошибка фильтрации:', err);
      setError(tCommon('errors.generic'));
    }
  };

  // Локальная фильтрация для realtime вставок, которые могли уже прилететь в стейт
  const filteredEntries = entries.filter(e => filter === 'all' || e.type === filter);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Баннер утренних напоминаний */}
      <PushBanner />

      {/* Форма публикации сигнала */}
      <InlineEntryForm />

      {/* Фильтры */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => handleFilterChange('all')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
            filter === 'all' 
              ? 'bg-primary text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50'
          }`}
        >
          {tf('allSignals', tf('filters.all', 'All'))}
        </button>
        <button
          onClick={() => handleFilterChange('dream')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
            filter === 'dream' 
              ? 'bg-primary text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50'
          }`}
        >
          {tf('dreams', tf('filters.dreams', 'Dreams'))}
        </button>
        <button
          onClick={() => handleFilterChange('premonition')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
            filter === 'premonition' 
              ? 'bg-primary text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50'
          }`}
        >
          {tf('premonitions', tf('filters.premonitions', 'Premonitions'))}
        </button>
      </div>

      {/* Пустое состояние или Ошибка фильтра */}
      {error && !loadingMore && filteredEntries.length === 0 ? (
        <div className="card glass text-center py-20 px-6 flex flex-col items-center border-border">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => handleFilterChange(filter)} className="px-6 py-2 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors">
            {tCommon('errors.tryAgain')}
          </button>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredEntries.map((entry) => (
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
            {filter === 'all' 
              ? tf('empty', t('emptyAll')) 
              : filter === 'dream' 
                ? tf('emptyDreams', t('emptyDreams')) 
                : tf('emptyPremonitions', t('emptyPremonitions'))}
          </h2>
        </div>
      )}

      {/* Кнопка "Загрузить ещё" или Ошибка пагинации */}
      {filteredEntries.length > 0 && hasMore && (
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
            <div key={i} className="rounded-2xl border border-gray-100 p-5">
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
