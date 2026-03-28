'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { ArrowRight, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { MatchData } from '@/lib/matches';

interface MatchDetailProps {
  match: MatchData;
  entry?: {
    id: string;
    title: string | null;
    content: string;
    type: string;
    created_at: string;
    user?: {
      username: string;
      avatar_url: string | null;
      role: string;
    };
  };
  variant: 'compact' | 'full' | 'inline';
  showEntryLink?: boolean;
  showEventLink?: boolean;
}

export default function MatchDetail({
  match,
  entry,
  variant,
  showEntryLink = true,
  showEventLink = true,
}: MatchDetailProps) {
  const t = useTranslations('match');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(variant !== 'inline');
  const [shareCopied, setShareCopied] = useState(false);
  const dateLocale = locale === 'en' ? enUS : ru;
  const score = Math.round((match.similarity_score || 0) * 100);
  const highlightIso = match.geography_match?.event_geography || match.geography_match?.entry_geography || '';
  const shareOgUrl = (() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    params.set('type', 'match');
    params.set('entry_id', entry?.id || match.entry_id);
    params.set('match_id', match.id);
    params.set('score', String(score));
    params.set('event_title', match.event_title || '');
    params.set('quote', (entry?.content || '').slice(0, 180));
    params.set('author', entry?.user?.username || '');
    params.set('date', match.event_date ? new Date(match.event_date).toLocaleDateString() : '');
    return origin ? `${origin}/api/og?${params.toString()}` : '';
  })();

  const handleShareMatch = async () => {
    if (!shareOgUrl) return;
    try {
      await navigator.clipboard.writeText(shareOgUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      setShareCopied(false);
    }
  };

  if (variant === 'inline') {
    return (
      <div className="mt-3">
        <button
          type="button"
          className="w-full flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">{t('confirmed', { score })}</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-emerald-600">
            {typeof match.temporal_match?.days_before_event === 'number'
              ? t('daysBefore', { days: match.temporal_match.days_before_event })
              : ''}
            <ChevronDown className={`w-4 h-4 text-emerald-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {expanded && (
          <div className="mt-2 p-4 bg-white border border-emerald-100 rounded-xl space-y-3 animate-fade-in">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{t('event')}</p>
              <p className="text-sm font-medium text-gray-800">{match.event_title}</p>
              {match.event_description ? <p className="text-xs text-gray-500 mt-1 line-clamp-2">{match.event_description}</p> : null}
            </div>
            {match.sensory_match?.matched_sensations?.length ? (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{t('sensoryMatch')}</p>
                <div className="flex flex-wrap gap-1">
                  {match.sensory_match.matched_sensations.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {match.geography_match?.match_type !== 'none' ? (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <MapPin className="w-3 h-3" />
                <span>{match.geography_match?.event_geography}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <Link href="/discoveries?tab=matches" className="text-xs text-primary hover:underline flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                {t('seeAllMatches')}
              </Link>
              {highlightIso ? (
                <Link href={`/map?highlight=${encodeURIComponent(highlightIso)}`} className="text-xs text-primary hover:underline">
                  {t('showOnMap')}
                </Link>
              ) : null}
              {showEventLink && match.event_url ? (
                <a href={match.event_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {t('openSource')}
                </a>
              ) : null}
              <button type="button" onClick={handleShareMatch} className="text-xs text-primary hover:underline">
                {t('shareMatch')}
              </button>
              {shareCopied ? <span className="text-xs text-emerald-600">{t('shareCopied')}</span> : null}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="border border-border rounded-xl p-3 bg-surface">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
          <div className="min-w-0">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{t('yourEntry')}</p>
            {entry?.user?.username ? (
              <Link
                href={`/profile/${entry.user.username}`}
                className="text-xs font-medium text-primary hover:underline mb-1 block"
              >
                @{entry.user.username}
              </Link>
            ) : null}
            {showEntryLink && entry?.id ? (
              <Link href={`/entry/${entry.id}`} className="text-sm font-medium text-text-primary hover:text-primary line-clamp-2">
                {entry.title || entry.content.slice(0, 70)}
              </Link>
            ) : (
              <p className="text-sm font-medium text-text-primary line-clamp-2">{entry?.title || entry?.content?.slice(0, 70) || '-'}</p>
            )}
          </div>
          <div className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-sm font-semibold">{score}%</div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{t('event')}</p>
            <p className="text-sm font-medium text-text-primary line-clamp-2">{match.event_title}</p>
            {showEventLink && match.event_url ? (
              <a href={match.event_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                <ExternalLink className="w-3 h-3" />
                {t('source')}
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-secondary">
          <Link href="/discoveries?tab=matches" className="text-primary hover:underline">{t('seeAllMatches')}</Link>
          {highlightIso ? (
            <Link href={`/map?highlight=${encodeURIComponent(highlightIso)}&match=${encodeURIComponent(match.id)}`} className="text-primary hover:underline">
              {t('showOnMap')}
            </Link>
          ) : null}
          <button type="button" onClick={handleShareMatch} className="text-primary hover:underline">
            {t('shareMatch')}
          </button>
          {shareCopied ? <span className="text-emerald-600">{t('shareCopied')}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="grid md:grid-cols-[1fr,auto,1fr] gap-3 items-center">
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">{t('yourEntry')}</p>
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{entry?.title || entry?.content?.slice(0, 90) || '-'}</p>
        </div>
        <div className="text-emerald-700 font-bold text-lg">{score}%</div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">{t('event')}</p>
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{match.event_title}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {(match.matched_symbols || []).slice(0, 8).map((s) => (
          <span key={s} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">{s}</span>
        ))}
      </div>
      {match.sensory_match?.matched_sensations?.length ? (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">{t('sensoryMatch')}</p>
          <div className="flex flex-wrap gap-1">
            {match.sensory_match.matched_sensations.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-700 text-xs rounded-full">{s}</span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 text-xs text-gray-500">
        {formatDistanceToNow(new Date(match.event_date), { addSuffix: true, locale: dateLocale })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href="/discoveries?tab=matches" className="text-primary hover:underline">{t('seeAllMatches')}</Link>
        {highlightIso ? (
          <Link href={`/map?highlight=${encodeURIComponent(highlightIso)}`} className="text-primary hover:underline">{t('showOnMap')}</Link>
        ) : null}
        {showEventLink && match.event_url ? (
          <a href={match.event_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t('openSource')}</a>
        ) : null}
        <button type="button" onClick={handleShareMatch} className="text-primary hover:underline">
          {t('shareMatch')}
        </button>
        {shareCopied ? <span className="text-emerald-600">{t('shareCopied')}</span> : null}
      </div>
    </div>
  );
}
