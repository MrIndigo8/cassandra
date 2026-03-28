'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { SendHorizontal, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { Link } from '@/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';

interface CardCommentsProps {
  entryId: string;
  isOpen: boolean;
  commentCount: number;
  onCountChange?: (newCount: number) => void;
}

interface CardComment {
  id: string;
  entry_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: {
    id?: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

function avatarColor(username: string): string {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-cyan-500', 'bg-rose-500'];
  const hash = username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export default function CardComments({ entryId, isOpen, commentCount, onCountChange }: CardCommentsProps) {
  const t = useTranslations('comments');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : ru;
  const supabase = createClient();
  const { user, profile } = useUser();

  const [comments, setComments] = useState<CardComment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || loadedRef.current) return;

    const load = async () => {
      const res = await fetch(`/api/comments?entry_id=${entryId}`);
      const data = await res.json();
      const next = (data.data || []) as CardComment[];
      setComments(next);
      onCountChange?.(next.length);
      loadedRef.current = true;
    };

    void load();
  }, [entryId, isOpen, onCountChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`card-comments:${entryId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `entry_id=eq.${entryId}` },
        async (payload: RealtimePostgresInsertPayload<CardComment>) => {
          const incoming = payload.new as CardComment;
          const exists = comments.some((c) => c.id === incoming.id);
          if (exists) return;

          // For external inserts we refetch once to attach joined users reliably.
          const res = await fetch(`/api/comments?entry_id=${entryId}`);
          const data = await res.json();
          const next = (data.data || []) as CardComment[];
          setComments(next);
          onCountChange?.(next.length);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [comments, entryId, onCountChange, supabase]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const visibleComments = useMemo(() => {
    return showAll ? comments : comments.slice(0, 3);
  }, [comments, showAll]);
  const effectiveCount = comments.length > 0 ? comments.length : commentCount;

  const handleSubmit = async () => {
    if (!user || !text.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    const content = text.trim();
    setText('');

    const tempId = `temp-${Date.now()}`;
    const optimistic: CardComment = {
      id: tempId,
      entry_id: entryId,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      users: {
        id: user.id,
        username: profile?.username || t('you'),
        avatar_url: profile?.avatar_url || null,
      },
    };

    setComments((prev) => {
      const next = [...prev, optimistic];
      onCountChange?.(next.length);
      return next;
    });

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, content }),
      });

      if (!res.ok) throw new Error('post_failed');
      const data = await res.json();
      const saved = data.data as CardComment;

      setComments((prev) => {
        const replaced = prev.map((c) => (c.id === tempId ? saved : c));
        return replaced;
      });
    } catch {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== tempId);
        onCountChange?.(next.length);
        return next;
      });
      setError(t('error'));
      setText(content);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = comments;
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      onCountChange?.(next.length);
      return next;
    });

    const queryRes = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
    if (queryRes.ok) return;

    const bodyRes = await fetch('/api/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!bodyRes.ok) {
      setComments(previous);
      onCountChange?.(previous.length);
      setError(t('error'));
    }
  };

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="bg-surface-hover rounded-xl mt-3 p-4 border border-border">
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {visibleComments.map((comment) => {
            const username = comment.users?.username || t('anonymous');
            const isMine = !!user && comment.user_id === user.id;
            const profileHref = comment.users?.username ? `/profile/${comment.users.username}` : null;
            return (
              <div key={comment.id} className="group border-b border-border pb-2 last:border-b-0">
                <div className="flex items-start gap-2">
                  {profileHref ? (
                    <Link
                      href={profileHref}
                      className={`w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-white font-semibold ${avatarColor(username)}`}
                    >
                      {comment.users?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={comment.users.avatar_url} alt={username} className="w-full h-full object-cover" />
                      ) : (
                        <span>{username[0]?.toUpperCase()}</span>
                      )}
                    </Link>
                  ) : (
                    <div className={`w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-white font-semibold ${avatarColor(username)}`}>
                      {comment.users?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={comment.users.avatar_url} alt={username} className="w-full h-full object-cover" />
                      ) : (
                        <span>{username[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {profileHref ? (
                        <Link href={profileHref} className="text-sm font-medium text-text-primary hover:text-primary transition-colors">
                          {username}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-text-primary">{username}</span>
                      )}
                      <span className="text-xs text-text-muted">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}
                      </span>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDelete(comment.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-500"
                          aria-label="delete-comment"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5 break-words">{comment.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {effectiveCount > 3 && !showAll && (
          <div className="mt-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setShowAll(true)}
            >
              {t('showAll', { count: effectiveCount })}
            </button>
            <span className="text-xs text-text-muted mx-2">·</span>
            <Link href={`/entry/${entryId}`} className="text-xs text-text-secondary hover:text-text-primary hover:underline">
              {t('openThread')}
            </Link>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
          <div className={`w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-white font-semibold ${avatarColor(profile?.username || 'me')}`}>
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username || 'me'} className="w-full h-full object-cover" />
            ) : (
              <span>{(profile?.username || 'M')[0].toUpperCase()}</span>
            )}
          </div>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={t('placeholder')}
            className="rounded-full bg-surface border border-border px-4 py-2 text-sm text-text-primary flex-1 focus:ring-1 focus:ring-primary/30"
            disabled={!user || submitting}
          />

          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
              disabled={submitting || !user}
              aria-label={t('send')}
            >
              <SendHorizontal size={16} />
            </button>
          )}
        </div>

        {!user && (
          <p className="text-xs text-text-muted mt-2">
            {t('authRequired')}
          </p>
        )}
      </div>
    </div>
  );
}

