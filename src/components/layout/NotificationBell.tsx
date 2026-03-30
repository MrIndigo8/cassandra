'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import type { Notification } from '@/types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

type GroupKey = 'today' | 'yesterday' | 'week' | 'earlier';

function timeAgoLabel(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function groupByDate(items: Notification[]): Record<GroupKey, Notification[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const groups: Record<GroupKey, Notification[]> = {
    today: [],
    yesterday: [],
    week: [],
    earlier: [],
  };

  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart) groups.today.push(n);
    else if (t >= yesterdayStart) groups.yesterday.push(n);
    else if (t >= weekStart) groups.week.push(n);
    else groups.earlier.push(n);
  }
  return groups;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('notifications');

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;
  const grouped = groupByDate(notifications);

  const fetchNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'eq', 'scheduled')
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      setNotifications((data || []) as Notification[]);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    let channelInstance: ReturnType<typeof supabase.channel> | null = null;
    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channelInstance = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload: RealtimePostgresInsertPayload<Notification>) => {
            const n = payload.new;
            if (n.status === 'scheduled' || n.status === 'cancelled') return;
            setNotifications((prev) => [n, ...prev].slice(0, 60));
          }
        )
        .subscribe();
    };
    setupRealtime();
    return () => {
      if (channelInstance) supabase.removeChannel(channelInstance);
    };
  }, [supabase]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const markAsRead = async (notif: Notification) => {
    if (notif.status === 'unread') {
      await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, status: 'read' } : n)));
    }
  };

  const openNotification = async (notif: Notification) => {
    await markAsRead(notif);
    const actionTarget = (notif.data?.action_target as string | undefined) || null;
    if (actionTarget) {
      router.push(actionTarget);
      setIsOpen(false);
      return;
    }
    if (notif.entry_id) {
      router.push(`/entry/${notif.entry_id}`);
      setIsOpen(false);
      return;
    }
    if (notif.action_type === 'similar_patterns') {
      router.push('/map');
      setIsOpen(false);
    }
  };

  const handleSelfReport = async (entryId: string, status: 'fulfilled' | 'partial' | 'unfulfilled') => {
    try {
      const mapped = status === 'unfulfilled' ? 'not_fulfilled' : status;
      const res = await fetch('/api/self-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, status: mapped }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => !(n.entry_id === entryId && n.action_type === 'self_report')));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const iconByAction: Record<string, string> = {
    deep_insight: '✦',
    similar_patterns: '🔗',
    tracking_update: '🔮',
    weekly_report: '📊',
    self_report: '🧭',
    match_found: '🔴',
  };

  const sectionTitle: Record<GroupKey, string> = {
    today: t('today'),
    yesterday: t('yesterday'),
    week: t('thisWeek'),
    earlier: t('earlier'),
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative h-9 w-9 rounded-full border border-border/40 bg-surface/70 text-text-secondary hover:text-text-primary"
        title={t('title')}
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} aria-label="close" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-border/40 bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">✦ {t('title')}</h3>
              <button className="text-text-muted hover:text-text-primary" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            <div className="h-[calc(100%-56px)] overflow-y-auto px-3 py-3">
              {loading ? <p className="py-8 text-sm text-text-muted">{t('loading')}</p> : null}
              {error ? <p className="py-8 text-sm text-red-400">{t('errorLoading')}</p> : null}
              {!loading && !error && notifications.length === 0 ? (
                <p className="py-8 text-sm text-text-muted">{t('empty')}</p>
              ) : null}

              {(['today', 'yesterday', 'week', 'earlier'] as GroupKey[]).map((k) => {
                const items = grouped[k];
                if (!items.length) return null;
                return (
                  <section key={k} className="mb-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{sectionTitle[k]}</p>
                    <div className="space-y-2">
                      {items.map((notif) => (
                        <article
                          key={notif.id}
                          className={`rounded-xl border border-border/30 bg-surface/60 p-3 transition-opacity ${
                            notif.status === 'read' ? 'opacity-75' : 'opacity-100'
                          }`}
                        >
                          <button className="w-full text-left" onClick={() => openNotification(notif)}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-text-primary">
                                {(notif.action_type && iconByAction[notif.action_type]) || '📌'} {notif.title}
                              </p>
                              <span className="text-[11px] text-text-muted">{timeAgoLabel(notif.created_at)}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-text-secondary">{notif.message}</p>
                          </button>

                          {notif.action_type === 'self_report' && notif.entry_id ? (
                            <div className="mt-2 flex gap-1.5">
                              <button
                                onClick={() => handleSelfReport(notif.entry_id!, 'fulfilled')}
                                className="rounded-md bg-emerald-600/80 px-2 py-1 text-[11px] text-white"
                              >
                                ✅ {t('yes')}
                              </button>
                              <button
                                onClick={() => handleSelfReport(notif.entry_id!, 'partial')}
                                className="rounded-md bg-amber-600/80 px-2 py-1 text-[11px] text-white"
                              >
                                🔶 {t('partly')}
                              </button>
                              <button
                                onClick={() => handleSelfReport(notif.entry_id!, 'unfulfilled')}
                                className="rounded-md bg-zinc-600/80 px-2 py-1 text-[11px] text-white"
                              >
                                ❌ {t('no')}
                              </button>
                            </div>
                          ) : null}

                          {notif.entry_id ? (
                            <button
                              onClick={() => {
                                router.push(`/entry/${notif.entry_id}`);
                                setIsOpen(false);
                              }}
                              className="mt-2 text-xs text-primary hover:underline"
                            >
                              {t('openEntry')}
                            </button>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
