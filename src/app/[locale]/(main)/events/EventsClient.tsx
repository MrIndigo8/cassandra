'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Activity, ChevronDown, ChevronUp, GitCompare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import MatchDetail from '@/components/MatchDetail';
import { useSearchParams } from 'next/navigation';
import ArchiveClient, { type HistoricalCase } from '../archive/ArchiveClient';

type Tab = 'matches' | 'worldEvents' | 'archive';
type Section = 'relevant' | 'all';

type RelevanceReasonType = 'geography' | 'sensory' | 'keywords';

interface RelevanceReasonDetail {
  type: RelevanceReasonType;
  detail: string;
  matchedPatterns?: string[];
  matchedKeywords?: string[];
  matchedEntries: Array<{ id: string; title: string; date: string }>;
}

interface InitialMatch {
  id: string;
  similarity_score: number;
  matched_symbols: string[] | null;
  verification_data?: {
    sensory_match?: {
      matched_sensations?: string[];
      event_nature?: string;
      mapping_quality?: string;
    };
    geography_match?: {
      entry_geography?: string | null;
      event_geography?: string;
      match_type?: string;
    };
    temporal_match?: {
      days_before_event?: number;
      is_prediction?: boolean;
    };
  } | null;
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
        geography_iso?: string | null;
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
        geography_iso?: string | null;
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
  originalTitle?: string | null;
  url: string;
  publishedAt: string;
  geography: string | null;
  category: string | null;
  relevanceScore: number;
  relevanceReasons: RelevanceReasonDetail[];
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
  initialCases?: HistoricalCase[];
  defaultTab?: Tab;
  showTitle?: boolean;
}

function categoryDotClass(category: string | null): string {
  const c = (category || '').toLowerCase();
  if (c.includes('conflict') || c.includes('war')) return 'category-dot-conflict';
  if (c.includes('earthquake') || c.includes('disaster')) return 'category-dot-earthquake';
  if (c.includes('politic')) return 'category-dot-politics';
  if (c.includes('econom')) return 'category-dot-economy';
  return 'category-dot-other';
}

export default function EventsClient({
  initialMatches,
  initialClusters,
  initialCases = [],
  defaultTab,
  showTitle = true,
}: EventsClientProps) {
  const tEvents = useTranslations('events');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const dateLocale = locale === 'en' ? enUS : ru;
  const tabParam = searchParams.get('tab');
  const initialTab = defaultTab || (tabParam === 'worldEvents' ? 'worldEvents' : tabParam === 'archive' ? 'archive' : 'matches');

  const [tab, setTab] = useState<Tab>(initialTab);
  const [section, setSection] = useState<Section>('relevant');
  const [events, setEvents] = useState<EventApiItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
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
      const res = await fetch(`/api/events?section=${targetSection}&page=${targetPage}&limit=20&locale=${locale}`);
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
      {showTitle && (
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary">{tEvents('title')}</h1>
          <p className="text-text-secondary mt-1">{tEvents('subtitle')}</p>
        </header>
      )}

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
        <button
          type="button"
          onClick={() => setTab('archive')}
          className={`tab-pill ${tab === 'archive' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tNav('archive')}
        </button>
      </div>

      {initialClusters.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-text-secondary mb-3">{tEvents('activeSignals')}</h2>
          <div className="space-y-3">
            {initialClusters.map((cluster) => {
              const intensity = Math.max(0, Math.min(10, Number(cluster.intensity_score || 0)));
              const progress = (intensity / 10) * 100;
              return (
                <div key={cluster.id} className="signal-card">
                  <Activity className="text-amber-600" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">{cluster.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(cluster.dominant_images || []).slice(0, 4).map((img) => (
                        <span key={img} className="symbol-tag">#{img}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-text-muted flex gap-3">
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

      {tab === 'archive' ? (
        <section className="card p-4">
          <ArchiveClient initialCases={initialCases} />
        </section>
      ) : tab === 'matches' ? (
        <section className="space-y-4">
          {normalizedMatches.length === 0 ? (
            <div className="match-card text-center py-10">
              <GitCompare className="mx-auto text-text-muted mb-3" />
              <p className="text-lg font-semibold text-text-primary">{tEvents('noMatches')}</p>
              <p className="text-sm text-text-secondary mt-2">{tEvents('noMatchesHint')}</p>
            </div>
          ) : (
            normalizedMatches.map(({ match, entry }) => {
              return (
                <article key={match.id} className="match-card">
                  <MatchDetail
                    variant="compact"
                    match={{
                      id: match.id,
                      entry_id: entry?.id || '',
                      similarity_score: match.similarity_score,
                      matched_symbols: match.matched_symbols || [],
                      event_title: match.event_title,
                      event_description: match.event_description,
                      event_url: match.event_url,
                      event_date: match.event_date,
                      created_at: match.created_at,
                      sensory_match: match.verification_data?.sensory_match
                        ? {
                            matched_sensations: match.verification_data.sensory_match.matched_sensations || [],
                            event_nature: match.verification_data.sensory_match.event_nature || '',
                            mapping_quality: match.verification_data.sensory_match.mapping_quality || '',
                          }
                        : undefined,
                      geography_match: {
                        entry_geography: entry?.geography_iso || null,
                        event_geography:
                          match.verification_data?.geography_match?.event_geography ||
                          entry?.geography_iso ||
                          '',
                        match_type: match.verification_data?.geography_match?.match_type || 'region',
                      },
                      temporal_match: match.verification_data?.temporal_match
                        ? {
                            days_before_event: match.verification_data.temporal_match.days_before_event || 0,
                            is_prediction: Boolean(match.verification_data.temporal_match.is_prediction),
                          }
                        : undefined,
                    }}
                    entry={entry ? {
                      id: entry.id,
                      title: entry.title,
                      content: entry.content,
                      type: entry.type,
                      created_at: entry.created_at,
                    } : undefined}
                    showEntryLink
                    showEventLink
                  />
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
                  <p className="text-base font-medium text-text-primary">{event.title}</p>
                  {locale === 'ru' && event.originalTitle && event.originalTitle !== event.title && (
                    <p className="text-xs text-text-muted italic mt-0.5 line-clamp-1">{event.originalTitle}</p>
                  )}
                  {event.description && (
                    <p className="text-sm text-text-secondary line-clamp-2 mt-1">{event.description}</p>
                  )}
                  <div className="mt-2 text-xs text-text-muted flex flex-wrap items-center gap-2">
                    <span>{formatDistanceToNow(new Date(event.publishedAt), { addSuffix: true, locale: dateLocale })}</span>
                    {event.geography && <span>· {event.geography}</span>}
                    {section === 'relevant' && event.relevanceReasons?.[0] && (
                      <span className="relevance-badge">
                        {event.relevanceReasons[0].type === 'geography' && `📍 ${tEvents('relevance.geography')}`}
                        {event.relevanceReasons[0].type === 'sensory' && `🧠 ${tEvents('relevance.sensory')}`}
                        {event.relevanceReasons[0].type === 'keywords' && `✨ ${tEvents('relevance.keywords')}`}
                      </span>
                    )}
                    {section === 'relevant' && event.relevanceReasons?.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-primary inline-flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedReasons((prev) => ({ ...prev, [event.id]: !prev[event.id] }));
                        }}
                      >
                        {expandedReasons[event.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expandedReasons[event.id] ? tEvents('hideDetails') : tEvents('showDetails')}
                      </button>
                    )}
                  </div>

                  {section === 'relevant' && expandedReasons[event.id] && event.relevanceReasons?.length > 0 && (
                    <div className="mt-3 p-4 bg-surface rounded-xl border border-primary/20" onClick={(e) => e.stopPropagation()}>
                      <h4 className="text-sm font-semibold text-text-primary mb-3">{tEvents('whyRelevant')}</h4>
                      {event.relevanceReasons.map((reason, i) => (
                        <div key={`${event.id}-reason-${i}`} className="flex items-start gap-3 mb-3 last:mb-0">
                          <span className="text-lg mt-0.5">
                            {reason.type === 'geography' && '📍'}
                            {reason.type === 'sensory' && '🧠'}
                            {reason.type === 'keywords' && '✨'}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-text-secondary">{reason.detail}</p>
                            {reason.matchedPatterns && reason.matchedPatterns.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {reason.matchedPatterns.map((pattern) => (
                                  <span key={pattern} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                                    {pattern}
                                  </span>
                                ))}
                              </div>
                            )}
                            {reason.matchedKeywords && reason.matchedKeywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {reason.matchedKeywords.map((keyword) => (
                                  <span key={keyword} className="px-2 py-0.5 bg-surface border border-border text-text-secondary text-xs rounded-full">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
                            {reason.matchedEntries?.map((entry) => (
                              <Link
                                key={entry.id}
                                href={`/entry/${entry.id}`}
                                className="flex items-center gap-2 mt-2 p-2 bg-surface rounded-lg border border-border hover:border-primary/30 transition-colors"
                              >
                                <div className="w-1 h-8 bg-primary/30 rounded-full" />
                                <div>
                                  <p className="text-sm font-medium text-text-primary line-clamp-1">{entry.title}</p>
                                  <p className="text-xs text-text-muted">
                                    {formatDistanceToNow(new Date(entry.date), { addSuffix: true, locale: dateLocale })}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
