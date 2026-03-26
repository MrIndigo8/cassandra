'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import CardComments from './CardComments';
import EntryLike from './EntryLike';

export interface FeedEntry {
  id: string;
  type: string;
  title: string | null;
  content: string;
  image_url: string | null;
  is_verified: boolean;
  best_match_score: number | null;
  view_count: number;
  created_at: string;
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
}: EntryCardProps) {
  const tEntry = useTranslations('entry');
  const tRole = useTranslations('role');
  const tActions = useTranslations('actions');
  const locale = useLocale();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(comments_count);
  const [localViewCount, setLocalViewCount] = useState(entry.view_count || 0);
  const [linkCopied, setLinkCopied] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);

  const dateLocale = locale === 'en' ? enUS : ru;
  const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: dateLocale });

  const roleBadge = useMemo(() => {
    const role = user.role || 'observer';
    if (role === 'oracle') return { icon: '⭐', cls: 'bg-amber-100 text-amber-700 shadow-glow-sm', label: tRole('oracle') };
    if (role === 'sensitive') return { icon: '🌊', cls: 'bg-violet-100 text-violet-700', label: tRole('sensitive') };
    if (role === 'chronicler') return { icon: '📘', cls: 'bg-blue-100 text-blue-700', label: tRole('chronicler') };
    return { icon: '👁️', cls: 'bg-gray-100 text-gray-700', label: tRole('observer') };
  }, [tRole, user.role]);

  const typeBadge = useMemo(() => {
    const type = entry.type || 'unknown';
    if (type === 'dream') return { icon: '🌙', cls: 'bg-indigo-100 text-indigo-700', label: tEntry('type.dream') };
    if (type === 'premonition') return { icon: '⚡', cls: 'bg-amber-100 text-amber-700', label: tEntry('type.premonition') };
    if (type === 'feeling') return { icon: '💜', cls: 'bg-pink-100 text-pink-700', label: tEntry('type.feeling') };
    if (type === 'vision') return { icon: '👁', cls: 'bg-violet-100 text-violet-700', label: tEntry('type.vision') };
    return { icon: '❓', cls: 'bg-gray-100 text-gray-600', label: tEntry('type.unknown') };
  }, [entry.type, tEntry]);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}/entry/${entry.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  };

  useEffect(() => {
    const target = cardRef.current;
    if (!target || viewTrackedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || viewTrackedRef.current) return;
        viewTrackedRef.current = true;

        // fire-and-forget tracking once per card mount
        fetch('/api/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entry.id }),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data?.view_count === 'number') {
              setLocalViewCount(data.view_count);
            }
          })
          .catch(() => {});

        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [entry.id]);

  return (
    <article ref={cardRef} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all duration-200">
      <header className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-semibold ${avatarColor(user.username)}`}>
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <span>{(user.username || '?')[0].toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{user.username}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${roleBadge.cls}`}>
              <span>{roleBadge.icon}</span>
              <span>{roleBadge.label}</span>
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1.5">
            <span>⚡ {Number(user.rating_score || 0).toFixed(1)}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        <div className="ml-auto">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${typeBadge.cls}`}>
            <span>{typeBadge.icon}</span>
            <span>{typeBadge.label}</span>
          </span>
        </div>
      </header>

      <div className="mt-3">
        {entry.title && (
          <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
            <Link href={`/entry/${entry.id}`} className="hover:text-primary transition-colors">
              {entry.title}
            </Link>
          </h3>
        )}

        <p className="text-base text-text-secondary line-clamp-3">{entry.content}</p>

        <div className="mt-2">
          <Link href={`/entry/${entry.id}`} className="text-sm text-primary hover:underline">
            {tEntry('readMore')}
          </Link>
        </div>

        {entry.image_url && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.image_url} alt={entry.title || 'entry-image'} className="rounded-xl max-h-64 w-full object-cover" />
          </div>
        )}

        {entry.is_verified && entry.best_match_score && entry.best_match_score > 0.6 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-3 inline-flex items-center gap-2 text-emerald-700 text-sm">
            <span className="animate-pulse">✓</span>
            <span>{tEntry('verified', { score: Math.round(entry.best_match_score * 100) })}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 pt-3 mt-3 border-t border-border/20">
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <EntryLike entryId={entry.id} initialCount={likes_count} initialLiked={user_liked} />
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsCommentsOpen((prev) => !prev);
          }}
        >
          <span>💬</span>
          <span>{localCommentsCount}</span>
        </button>

        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
          <span>👁</span>
          <span>{localViewCount}</span>
        </span>

        <button type="button" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700" onClick={handleShare}>
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
    </article>
  );
}
