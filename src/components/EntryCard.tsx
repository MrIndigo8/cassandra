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
import { useUser } from '@/hooks/useUser';
import CommunityConfirm from './CommunityConfirm';
import { getEntryTypePresentation } from '@/lib/entryTypePresentation';

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
  entry: {
    id: string;
    type: string;
    title: string | null;
    content: string;
    image_url: string | null;
    is_verified: boolean;
    best_match_score: number | null;
    view_count: number;
    created_at: string;
    prediction_potential?: number | null;
    user_insight?: string | null;
    sensory_data?: {
      sensory_patterns?: Array<{ sensation?: string }>;
      verification_keywords?: string[];
    } | null;
  };
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

function avatarColor(username: string): string {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500'];
  const hash = username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function EntryCard({
  entry,
  user,
  likes_count,
  comments_count,
  user_liked,
  community_count = 0,
  match,
}: EntryCardProps) {
  const tEntry = useTranslations('entry');
  const tRole = useTranslations('role');
  const tActions = useTranslations('actions');
  const locale = useLocale();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(comments_count);
  const [localViewCount] = useState(entry.view_count || 0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [communityCount, setCommunityCount] = useState(community_count);
  const { user: currentUser } = useUser();

  const dateLocale = locale === 'en' ? enUS : ru;
  const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: dateLocale });
  const userRole = user.role || 'observer';
  const userRating = user.rating_score ?? 0;

  const roleBadge = useMemo(() => {
    const role = userRole;
    if (role === 'oracle') return { icon: '⭐', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', label: tRole('oracle') };
    if (role === 'sensitive') return { icon: '🌊', cls: 'bg-violet-500/20 text-violet-300 border border-violet-500/30', label: tRole('sensitive') };
    if (role === 'chronicler') return { icon: '📘', cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', label: tRole('chronicler') };
    return { icon: '👁️', cls: 'bg-surface-hover text-text-secondary border border-border', label: tRole('observer') };
  }, [tRole, userRole]);

  const typeBadge = useMemo(
    () => getEntryTypePresentation(entry.type, tEntry),
    [entry.type, tEntry]
  );

  const highPrediction = Number(entry.prediction_potential ?? 0) > 0.7;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}/entry/${entry.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  };

  const canConfirm = currentUser && currentUser.id !== user.id && Number(entry.prediction_potential || 0) > 0.5;
  const communityPatterns = useMemo(() => {
    const sensory = (entry.sensory_data?.sensory_patterns || [])
      .map((p) => p?.sensation || '')
      .filter(Boolean);
    const keywords = (entry.sensory_data?.verification_keywords || []).filter(Boolean);
    return Array.from(new Set([...sensory, ...keywords]));
  }, [entry.sensory_data]);

  return (
    <article className="card card-hover p-5 transition-all duration-300">
      <header className="flex items-start gap-3">
        <Link
          href={`/profile/${user.username}`}
          className={`w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-semibold ${avatarColor(user.username)}`}
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <span>{(user.username || '?')[0].toUpperCase()}</span>
          )}
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${user.username}`} className="font-semibold text-text-primary truncate hover:text-primary transition-colors">
              {user.username}
            </Link>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${roleBadge.cls}`}>
              <span>{roleBadge.icon}</span>
              <span>{roleBadge.label}</span>
            </span>
          </div>
          <div className="text-xs text-text-secondary mt-0.5 inline-flex items-center gap-1.5">
            <span>⚡ {Number(userRating).toFixed(1)}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${typeBadge.cls}`}>
            <span>{typeBadge.icon}</span>
            <span>{typeBadge.label}</span>
          </span>
          {highPrediction && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30">
              {tEntry('highPredictionPotential')}
            </span>
          )}
        </div>
      </header>

      <div className="mt-3">
        <p className="text-base text-text-secondary line-clamp-3">{entry.content}</p>

        {entry.user_insight && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-text-secondary">
            <span className="text-xs font-semibold text-primary/90 uppercase tracking-wide">{tEntry('userInsight')}</span>
            <p className="mt-1 text-text-primary/90 leading-relaxed">{entry.user_insight}</p>
          </div>
        )}

        <div className="mt-2">
          <Link href={`/entry/${entry.id}`} className="text-sm text-primary hover:underline">
            {tEntry('readMore')}
          </Link>
        </div>

        {entry.image_url && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.image_url} alt="" className="rounded-xl max-h-64 w-full object-cover" />
          </div>
        )}

        {match && <MatchDetail match={match} variant="inline" showEntryLink={false} showEventLink />}
      </div>

      <div className="flex items-center gap-6 pt-3 mt-3 border-t border-border">
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <EntryLike entryId={entry.id} initialCount={likes_count} initialLiked={user_liked} />
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsCommentsOpen((prev) => !prev);
          }}
        >
          <span>💬</span>
          <span>{localCommentsCount}</span>
        </button>

        <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
          <span>👁</span>
          <span>{localViewCount}</span>
        </span>

        <button type="button" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary" onClick={handleShare}>
          <span>🔗</span>
          <span>{tActions('share')}</span>
        </button>

        {linkCopied && <span className="text-xs text-primary">{tEntry('linkCopied')}</span>}
      </div>

      <CardComments
        entryId={entry.id}
        isOpen={isCommentsOpen}
        commentCount={localCommentsCount}
        onCountChange={setLocalCommentsCount}
      />
      {(canConfirm || communityCount > 0) && (
        <div className="pt-3 mt-3 border-t border-border">
          <CommunityConfirm
            entryId={entry.id}
            enabled={Boolean(canConfirm)}
            initialCount={communityCount}
            patterns={communityPatterns}
            onCountChange={setCommunityCount}
          />
        </div>
      )}
    </article>
  );
}
