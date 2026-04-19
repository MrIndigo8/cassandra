'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import CardComments from './CardComments';
import EntryLike from './EntryLike';
import MatchDetail from './MatchDetail';
import type { MatchData } from '@/lib/matches';
import CommunityConfirm from './CommunityConfirm';
import { getEntryTypePresentation } from '@/lib/entryTypePresentation';

// ————————————————————————————————————————————————————————————————
// FeedEntry — интерфейс НЕ меняется (важно: FeedClient.tsx продолжает работать)
// ————————————————————————————————————————————————————————————————
export interface FeedEntry {
  id: string;
  type: string;
  title: string | null;
  content: string;
  image_url: string | null;
  is_verified: boolean;
  best_match_score: number | null;
  view_count: number;
  prediction_potential?: number | null;
  user_insight?: string | null;
  created_at: string;
  sensory_data?: {
    sensory_patterns?: Array<{ sensation?: string }>;
    verification_keywords?: string[];
  } | null;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    role: string;
    rating_score: number;
  };
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  community_count?: number;
  match?: MatchData | null;
}

interface EntryCardProps {
  entry: FeedEntry;
}

function avatarColor(username: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
    'bg-cyan-500', 'bg-amber-500', 'bg-pink-500',
  ];
  const hash = username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function EntryCard({ entry: e }: EntryCardProps) {
  const t = useTranslations('feed');
  const tRole = useTranslations('roles');
  const tEntry = useTranslations('entry');
  const locale = useLocale();
  const [showComments, setShowComments] = useState(false);

  const typePresentation = useMemo(
    () => getEntryTypePresentation(e.type, (key) => tEntry(key as Parameters<typeof tEntry>[0])),
    [e.type, tEntry]
  );

  const timeAgo = useMemo(
    () =>
      formatDistanceToNow(new Date(e.created_at), {
        addSuffix: true,
        locale: locale === 'ru' ? ru : enUS,
      }),
    [e.created_at, locale]
  );

  const initials = (e.user.username || '?').slice(0, 2).toUpperCase();

  return (
    <article className="card card-hover animate-fade-in space-y-4 hover:border-primary/40">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          href={`/profile/${e.user.username}`}
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-medium text-white ${avatarColor(
            e.user.username
          )}`}
        >
          {e.user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${e.user.username}`}
              className="truncate text-sm font-medium text-text-primary hover:text-primary"
            >
              @{e.user.username}
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[11px] text-text-secondary">
              {tRole(e.user.role)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
            <span>{timeAgo}</span>
            <span>·</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${typePresentation.cls}`}>
              <span>{typePresentation.icon}</span>
              <span>{typePresentation.label}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <Link href={`/entry/${e.id}`} className="block">
        {e.title && (
          <h3 className="mb-2 font-display text-lg font-semibold text-text-primary">{e.title}</h3>
        )}
        <p className="text-[15px] leading-relaxed text-text-primary/95" style={{ textWrap: 'pretty' as 'pretty' }}>
          {e.content}
        </p>
      </Link>

      {/* Image */}
      {e.image_url && (
        <Link href={`/entry/${e.id}`} className="block overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.image_url} alt="" className="h-auto w-full object-cover" />
        </Link>
      )}

      {/* Sensory + verification chips */}
      {(e.sensory_data?.sensory_patterns?.length || e.sensory_data?.verification_keywords?.length) && (
        <div className="flex flex-wrap gap-1.5">
          {e.sensory_data?.sensory_patterns?.map((s, i) =>
            s.sensation ? (
              <span
                key={`p-${i}`}
                className="rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[11px] text-text-secondary"
              >
                {s.sensation}
              </span>
            ) : null
          )}
          {e.sensory_data?.verification_keywords?.map((k, i) => (
            <span
              key={`k-${i}`}
              className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary-light"
            >
              #{k}
            </span>
          ))}
        </div>
      )}

      {/* Match banner */}
      {e.match && <MatchDetail match={e.match} variant="compact" />}

      {/* Footer actions */}
      <footer className="flex items-center justify-between border-t border-border pt-3 text-sm text-text-secondary">
        <div className="flex items-center gap-4">
          <EntryLike
            entryId={e.id}
            initialLiked={e.user_liked}
            initialCount={e.likes_count}
          />
          <button
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{e.comments_count}</span>
          </button>
          <span className="flex items-center gap-1.5 text-text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{e.view_count}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {typeof e.community_count === 'number' && e.community_count > 0 && (
            <CommunityConfirm
              entryId={e.id}
              enabled={true}
              initialCount={e.community_count}
              patterns={(e.sensory_data?.sensory_patterns ?? []).map((s) => s.sensation ?? '').filter(Boolean)}
            />
          )}
        </div>
      </footer>

      {/* Inline comments thread (existing component) */}
      <CardComments entryId={e.id} isOpen={showComments} commentCount={e.comments_count} />
    </article>
  );
}

export default EntryCard;
