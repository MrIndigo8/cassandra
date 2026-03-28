'use client';

import { useMemo, useState } from 'react';
import { Activity, GitCompare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import MatchDetail from '@/components/MatchDetail';
import ArchiveClient, { type HistoricalCase } from '../archive/ArchiveClient';

export type DiscoveriesMatchRow = {
  id: string;
  user_id: string;
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
        threat_type?: string | null;
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
        threat_type?: string | null;
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
};

type InitialCluster = {
  id: string;
  title: string;
  description: string | null;
  dominant_images: string[] | null;
  intensity_score: number | null;
  unique_users: number | null;
  entry_count: number | null;
  started_at: string | null;
};

export type RealitySnapshotRow = {
  id: string;
  snapshot_date: string;
  dominant_scenes: unknown;
  emotional_weather: unknown;
  archetype_activity: unknown;
  coherence_index: number | null;
  coherence_change: number | null;
  anomalies: unknown;
  prediction: unknown;
  total_entries_analyzed: number;
  total_users: number;
  created_at: string;
};

type Tab = 'matches' | 'archive';
type Scope = 'all' | 'mine';
type ThreatFilter =
  | 'all'
  | 'conflict'
  | 'disaster'
  | 'economic'
  | 'health'
  | 'social'
  | 'personal'
  | 'unknown';

interface DiscoveriesClientProps {
  initialMatches: DiscoveriesMatchRow[];
  currentUserId: string | null;
  initialClusters: InitialCluster[];
  initialCases: HistoricalCase[];
  latestSnapshot?: RealitySnapshotRow | null;
}

export default function DiscoveriesClient({
  initialMatches,
  currentUserId,
  initialClusters,
  initialCases,
  latestSnapshot,
}: DiscoveriesClientProps) {
  const t = useTranslations('discoveries');
  const tEvents = useTranslations('events');
  const tNav = useTranslations('nav');

  const [tab, setTab] = useState<Tab>('matches');
  const [scope, setScope] = useState<Scope>('all');
  const [threatFilter, setThreatFilter] = useState<ThreatFilter>('all');

  const normalizedMatches = useMemo(() => {
    return initialMatches.map((match) => {
      const entry = Array.isArray(match.entries) ? match.entries[0] : match.entries;
      return { match, entry };
    });
  }, [initialMatches]);

  const visibleMatches = useMemo(() => {
    let list = normalizedMatches;
    if (scope === 'mine' && currentUserId) {
      list = list.filter(({ match }) => match.user_id === currentUserId);
    }
    if (threatFilter !== 'all') {
      list = list.filter(({ entry }) => {
        const tt = (entry?.threat_type || 'unknown') as ThreatFilter;
        return tt === threatFilter;
      });
    }
    return list;
  }, [normalizedMatches, scope, currentUserId, threatFilter]);

  const THREAT_KEYS: ThreatFilter[] = [
    'all',
    'conflict',
    'disaster',
    'economic',
    'health',
    'social',
    'personal',
    'unknown',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">{t('title')}</h1>
        <p className="text-text-secondary mt-1">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('matches')}
          className={`tab-pill ${tab === 'matches' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tEvents('tabs.matches')}
        </button>
        <button
          type="button"
          onClick={() => setTab('archive')}
          className={`tab-pill ${tab === 'archive' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tNav('archive')}
        </button>
      </div>

      {latestSnapshot &&
        latestSnapshot.total_entries_analyzed >= 20 &&
        tab === 'matches' && (
        <section className="mb-6 rounded-2xl border border-border bg-surface-hover/40 p-4">
          <h2 className="text-sm font-semibold text-text-secondary mb-2">{t('snapshotTitle')}</h2>
          <p className="text-xs text-text-muted mb-2">
            {t('snapshotDate', { date: latestSnapshot.snapshot_date })}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            {latestSnapshot.coherence_index != null && (
              <span>
                {t('coherence')}:{' '}
                <strong className="text-text-primary">
                  {(latestSnapshot.coherence_index * 100).toFixed(0)}%
                </strong>
              </span>
            )}
            <span className="text-text-secondary">
              {t('entriesAnalyzed', { count: latestSnapshot.total_entries_analyzed })}
            </span>
          </div>
        </section>
      )}

      {initialClusters.length > 0 && tab === 'matches' && (
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
                        <span key={img} className="symbol-tag">
                          #{img}
                        </span>
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
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`tab-pill ${scope === 'all' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
            >
              {t('scopeAll')}
            </button>
            <button
              type="button"
              onClick={() => setScope('mine')}
              disabled={!currentUserId}
              className={`tab-pill ${scope === 'mine' ? 'tab-pill-active' : 'tab-pill-inactive'} disabled:opacity-40`}
            >
              {t('scopeMine')}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label={t('threatFilter.all')}>
            {THREAT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={threatFilter === key}
                onClick={() => setThreatFilter(key)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  threatFilter === key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {t(`threatFilter.${key}`)}
              </button>
            ))}
          </div>

          {visibleMatches.length === 0 ? (
            <div className="match-card text-center py-10">
              <GitCompare className="mx-auto text-text-muted mb-3" />
              <p className="text-lg font-semibold text-text-primary">
                {scope === 'mine' ? t('noMatchesMine') : tEvents('noMatches')}
              </p>
              <p className="text-sm text-text-secondary mt-2">
                {scope === 'mine' ? t('noMatchesMineHint') : tEvents('noMatchesHint')}
              </p>
            </div>
          ) : (
            visibleMatches.map(({ match, entry }) => (
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
                        match.verification_data?.geography_match?.event_geography || entry?.geography_iso || '',
                      match_type: match.verification_data?.geography_match?.match_type || 'region',
                    },
                    temporal_match: match.verification_data?.temporal_match
                      ? {
                          days_before_event: match.verification_data.temporal_match.days_before_event || 0,
                          is_prediction: Boolean(match.verification_data.temporal_match.is_prediction),
                        }
                      : undefined,
                  }}
                  entry={
                    entry
                      ? {
                          id: entry.id,
                          title: entry.title,
                          content: entry.content,
                          type: entry.type,
                          created_at: entry.created_at,
                        }
                      : undefined
                  }
                  showEntryLink
                  showEventLink
                />
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
