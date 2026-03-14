'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { EntryCard, type FeedEntry } from '@/components/EntryCard';

type FilterType = 'all' | 'dream' | 'premonition';

interface FeedClientProps {
  initialEntries: FeedEntry[];
}

export function FeedClient({ initialEntries }: FeedClientProps) {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialEntries.length === 20); // Зависит от PAGE_SIZE

  const PAGE_SIZE = 20;
  const [supabase] = useState(() => createClient());

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          // Когда приходит новая запись, у нас есть только данные entries, но нет users
          // Надо запросить профиль автора
          const newEntry = payload.new as import('@/types').Entry; // raw entry
          
          const { data: userData } = await supabase
            .from('users')
            .select('username, avatar_url')
            .eq('id', newEntry.user_id)
            .single();

          const fullEntry: FeedEntry = {
            ...newEntry,
            users: userData || null
          };

          // Добавляем в начало списка
          setEntries((prev) => [fullEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('entries')
        .select(`
          *,
          users:user_id (username, avatar_url)
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
        setEntries((prev) => [...prev, ...data as FeedEntry[]]);
        setPage((prev) => prev + 1);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Ошибка загрузки ленты:', err);
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
          *,
          users:user_id (username, avatar_url)
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
        setEntries(data as FeedEntry[]);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Ошибка фильтрации:', err);
    }
  };

  // Локальная фильтрация для realtime вставок, которые могли уже прилететь в стейт
  const filteredEntries = entries.filter(e => filter === 'all' || e.type === filter);

  return (
    <div className="max-w-[680px] mx-auto py-6 px-4">
      {/* Фильтры */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-6 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors shrink-0 ${
            filter === 'all' 
              ? 'bg-primary text-white border-primary' 
              : 'bg-surface text-text-secondary border-border hover:border-text-secondary/50'
          }`}
        >
          Все сигналы
        </button>
        <button
          onClick={() => handleFilterChange('dream')}
          className={`px-6 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-2 ${
            filter === 'dream' 
              ? 'bg-[#EFF6FF] text-secondary border-[#BAE6FD]' 
              : 'bg-surface text-text-secondary border-border hover:border-[#BAE6FD]'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${filter === 'dream' ? 'bg-secondary' : 'bg-border'}`}></span>
          Сны
        </button>
        <button
          onClick={() => handleFilterChange('premonition')}
          className={`px-6 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-2 ${
            filter === 'premonition' 
              ? 'bg-[#ECFDF5] text-primary border-[#A7F3D0]' 
              : 'bg-surface text-text-secondary border-border hover:border-[#A7F3D0]'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${filter === 'premonition' ? 'bg-primary' : 'bg-border'}`}></span>
          Предчувствия
        </button>
      </div>

      {/* Сетка карточек */}
      {filteredEntries.length > 0 ? (
        <div className="flex flex-col">
          {filteredEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
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
          <h2 className="text-2xl font-bold text-text-primary mb-3">Ноосфера молчит</h2>
          <p className="text-text-secondary max-w-md mx-auto mb-8">
            {filter === 'all' 
              ? 'В коллективном бессознательном пока нет активных сигналов. Будьте первым, кто внесет свой вклад в глобальную карту предчувствий.'
              : `Записей типа «${filter === 'dream' ? 'Сон' : 'Предчувствие'}» пока не найдено. Настройтесь на частоту и поделитесь видением.`}
          </p>
          <Link href="/entry/new" className="btn-primary py-3 px-8">
            Записать сигнал
          </Link>
        </div>
      )}

      {/* Кнопка "Загрузить ещё" */}
      {filteredEntries.length > 0 && hasMore && (
        <div className="mt-12 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-8 py-3 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50 font-medium"
          >
            {loadingMore ? 'Синхронизация...' : 'Погрузиться глубже'}
          </button>
        </div>
      )}
    </div>
  );
}
