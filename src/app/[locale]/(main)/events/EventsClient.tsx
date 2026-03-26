'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Activity, ExternalLink, GitCompare, Link2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';

type Tab = 'matches' | 'worldEvents';
type Section = 'relevant' | 'all';
type RelevanceReason = 'geography' | 'images' | 'keywords' | null;

interface InitialMatch {
  id: string;
  similarity_score: number;
  matched_symbols: string[] | null;
  event_title: string;
  event_description: string | null;
  event_url: string | null;
  event_date: string;
  created_at: string;
  entries:
    | {
        id: string;
        title: string | null;
        content: string;
        type: string;
        ai_summary: string | null;
        created_at: string;
        users:
          | {
              id: string;
              username: string;
              avatar_url: string | null;
              role: string | null;
              rating_score: number | null;
            }
          | Array<{
              id: string;
              username: string;
              avatar_url: string | null;
              role: string | null;
              rating_score: number | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        title: string | null;
        content: string;
        type: string;
        ai_summary: string | null;
        created_at: string;
        users:
          | {
              id: string;
              username: string;
              avatar_url: string | null;
              role: string | null;
              rating_score: number | null;
            }
          | Array<{
              id: string;
              username: string;
              avatar_url: string | null;
              role: string | null;
              rating_score: number | null;
            }>
          | null;
      }>
    | null;
}

interface InitialCluster {
  id: string;
  title: string;
  description: string | null;
  dominant_images: string[] | null;
  intensity_score: number | null;
  unique_users: number | null;
  entry_count: number | null;
  started_at: string | null;
}

interface EventApiItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  geography: string | null;
  category: string | null;
  relevanceScore: number;
  relevanceReason: RelevanceReason;
}

interface EventsApiResponse {
  events: EventApiItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface EventsClientProps {
  initialMatches: InitialMatch[];
  initialClusters: InitialCluster[];
}

function roleBadgeClass(role: string): string {
  if (role === 'oracle') return 'badge-role-oracle';
  if (role === 'sensitive') return 'badge-role-sensitive';
  if (role === 'chronicler') return 'badge-role-chronicler';
  return 'badge-role-observer';
}

function typeBadgeClass(type: string): string {
  if (type === 'dream') return 'badge-type-dream';
  if (type === 'premonition') return 'badge-type-premonition';
  if (type === 'feeling') return 'badge-type-feeling';
  if (type === 'vision') return 'badge-type-vision';
  return 'badge-type-unknown';
}

function categoryDotClass(category: string | null): string {
  const c = (category || '').toLowerCase();
  if (c.includes('conflict') || c.includes('war')) return 'category-dot-conflict';
  if (c.includes('earthquake') || c.includes('disaster')) return 'category-dot-earthquake';
  if (c.includes('politic')) return 'category-dot-politics';
  if (c.includes('econom')) return 'category-dot-economy';
  return 'category-dot-other';
}

export default function EventsClient({ initialMatches, initialClusters }: EventsClientProps) {
  const tEvents = useTranslations('events');
  const tEntry = useTranslations('entry');
  const tRole = useTranslations('role');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : ru;

  const [tab, setTab] = useState<Tab>('matches');
  const [section, setSection] = useState<Section>('relevant');
  const [events, setEvents] = useState<EventApiItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedForSection, setLoadedForSection] = useState<Record<Section, boolean>>({
    relevant: false,
    all: false,
  });

  const normalizedMatches = useMemo(() => {
    return initialMatches.map((match) => {
      const entry = Array.isArray(match.entries) ? match.entries[0] : match.entries;
      const user = Array.isArray(entry?.users) ? entry?.users[0] : entry?.users;
      return { match, entry, user };
    });
  }, [initialMatches]);

  const loadEvents = async (targetSection: Section, targetPage: number, append: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/events?section=${targetSection}&page=${targetPage}&limit=20`);
      if (!res.ok) throw new Error('load_failed');
      const data = (await res.json()) as EventsApiResponse;
      setEvents((prev) => (append ? [...prev, ...data.events] : data.events));
      setPage(data.page);
      setHasMore(data.hasMore);
      setLoadedForSection((prev) => ({ ...prev, [targetSection]: true }));
    } catch {
      setError(tEvents('error'));
    } finally {
      setLoading(false);
    }
  };

  const openWorldEventsTab = async () => {
    setTab('worldEvents');
    if (!loadedForSection[section]) {
      await loadEvents(section, 1, false);
    }
  };

  const switchSection = async (nextSection: Section) => {
    setSection(nextSection);
    if (!loadedForSection[nextSection]) {
      await loadEvents(nextSection, 1, false);
    } else {
      await loadEvents(nextSection, 1, false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{tEvents('title')}</h1>
        <p className="text-gray-500 mt-1">{tEvents('subtitle')}</p>
      </header>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('matches')}
          className={`tab-pill ${tab === 'matches' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tEvents('tabs.matches')}
        </button>
        <button
          type="button"
          onClick={() => {
            void openWorldEventsTab();
          }}
          className={`tab-pill ${tab === 'worldEvents' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tEvents('tabs.worldEvents')}
        </button>
      </div>

      {initialClusters.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{tEvents('activeSignals')}</h2>
          <div className="space-y-3">
            {initialClusters.map((cluster) => {
              const intensity = Math.max(0, Math.min(10, Number(cluster.intensity_score || 0)));
              const progress = (intensity / 10) * 100;
              return (
                <div key={cluster.id} className="signal-card">
                  <Activity className="text-amber-600" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{cluster.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(cluster.dominant_images || []).slice(0, 4).map((img) => (
                        <span key={img} className="symbol-tag">#{img}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-600 flex gap-3">
                      <span>{tEvents('signalUsers', { count: cluster.unique_users || 0 })}</span>
                      <span>{tEvents('signalEntries', { count: cluster.entry_count || 0 })}</span>
                    </div>
                    <div className="mt-2 w-full bg-amber-100 rounded-full h-1.5">
                      <div className="signal-intensity-bar" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'matches' ? (
        <section className="space-y-4">
          {normalizedMatches.length === 0 ? (
            <div className="match-card text-center py-10">
              <GitCompare className="mx-auto text-gray-300 mb-3" />
              <p className="text-lg font-semibold text-gray-700">{tEvents('noMatches')}</p>
              <p className="text-sm text-gray-500 mt-2">{tEvents('noMatchesHint')}</p>
            </div>
          ) : (
            normalizedMatches.map(({ match, entry, user }) => {
              const score = Math.round((match.similarity_score || 0) * 100);
              const high = score > 80;
              const symbols = (match.matched_symbols || [])
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 3);
              const role = user?.role || 'observer';
              const entryTitle = entry?.title || entry?.content?.slice(0, 60) || '...';
              return (
                <article key={match.id} className="match-card">
                  <div className="match-card-grid">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-semibold">
                          {(user?.username || 'A')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">{user?.username || tEntry('anonymous')}</span>
                        <span className={roleBadgeClass(role)}>{tRole(role as 'observer' | 'chronicler' | 'sensitive' | 'oracle')}</span>
                      </div>
                      <Link href={`/entry/${entry?.id || ''}`} className="font-semibold text-gray-900 hover:text-primary line-clamp-2 break-words">
                        {entryTitle}
                      </Link>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={typeBadgeClass(entry?.type || 'unknown')}>
                          {tEntry(`type.${entry?.type || 'unknown'}`)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {entry?.created_at
                            ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: dateLocale })
                            : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 min-w-[88px]">
                      <div className={`match-score-circle ${high ? 'match-score-high' : 'match-score-medium'}`}>{score}%</div>
                      <Link2 size={16} className="text-gray-400" />
                      <div className="flex flex-wrap justify-center gap-1 max-w-[220px]">
                        {symbols.map((symbol) => (
                          <span key={symbol} className="symbol-tag max-w-[200px] truncate">{symbol}</span>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 break-words line-clamp-6">{match.event_title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(match.event_date), { addSuffix: true, locale: dateLocale })}
                      </p>
                      {match.event_url && (
                        <a
                          href={match.event_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink size={14} />
                          {tEvents('eventSource')}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                void switchSection('relevant');
              }}
              className={`tab-pill ${section === 'relevant' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
            >
              {tEvents('forYou')}
            </button>
            <button
              type="button"
              onClick={() => {
                void switchSection('all');
              }}
              className={`tab-pill ${section === 'all' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
            >
              {tEvents('all')}
            </button>
          </div>

          {error && (
            <div className="match-card text-center mb-4">
              <p className="text-red-500">{error}</p>
              <button
                type="button"
                className="mt-2 btn-secondary"
                onClick={() => {
                  void loadEvents(section, 1, false);
                }}
              >
                {tEvents('tryAgain')}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="event-card"
                onClick={() => window.open(event.url, '_blank', 'noopener,noreferrer')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') window.open(event.url, '_blank', 'noopener,noreferrer');
                }}
              >
                <span className={`category-dot ${categoryDotClass(event.category)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-gray-900">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{event.description}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-400 flex flex-wrap items-center gap-2">
                    <span>{formatDistanceToNow(new Date(event.publishedAt), { addSuffix: true, locale: dateLocale })}</span>
                    {event.geography && <span>· {event.geography}</span>}
                    {section === 'relevant' && event.relevanceReason && (
                      <span className="relevance-badge">
                        {event.relevanceReason === 'geography' && `📍 ${tEvents('relevance.geography')}`}
                        {event.relevanceReason === 'images' && `🔗 ${tEvents('relevance.images')}`}
                        {event.relevanceReason === 'keywords' && `✨ ${tEvents('relevance.keywords')}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="space-y-2 mt-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="event-card">
                    <div className="w-3 h-3 rounded-full skeleton mt-1" />
                    <div className="w-full">
                      <div className="h-4 w-2/3 skeleton mb-2" />
                      <div className="h-3 w-full skeleton mb-2" />
                      <div className="h-3 w-1/2 skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasMore && !loading && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void loadEvents(section, page + 1, true);
                }}
              >
                {tEvents('loadMore')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
