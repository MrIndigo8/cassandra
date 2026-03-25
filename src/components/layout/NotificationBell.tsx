'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import type { Notification } from '@/types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('notifications');

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) setNotifications(data as Notification[]);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Загрузка при монтировании
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime подписка
  useEffect(() => {
    let channelInstance: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channelInstance = supabase
        .channel('notifications-' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresInsertPayload<Notification>) => {
            const newNotif = payload.new;
            setNotifications(prev => [newNotif, ...prev].slice(0, 20));
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
      }
    };
  }, [supabase]);

  // Клик вне dropdown — закрыть
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notif: Notification) => {
    if (notif.status === 'unread') {
      await supabase
        .from('notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', notif.id);

      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, status: 'read' } : n)
      );
    }

    // Навигация к записи
    // Навигация к записи
    const entryId = notif.data?.entry_id || notif.entry_id;
    if (entryId) {
      router.push(`/entry/${entryId}`);
      setIsOpen(false);
    }
  };

  const handleSelfReport = async (entryId: string, status: string) => {
    try {
      const res = await fetch('/api/self-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, status })
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => !(n.entry_id === entryId && n.action_type === 'self_report')));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const typeIcon: Record<string, string> = {
    match_found: '🔮',
    role_upgrade: '⭐',
    cluster_alert: '📡',
    streak_milestone: '🔥',
    system: '⚙️',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Кнопка-колокольчик */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        title="Уведомления"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Уведомления</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-bold">
                {unreadCount} новых
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-gray-400">
                <span className="text-sm italic">{t('loading')}</span>
              </div>
            ) : error ? (
              <div className="py-10 text-center text-red-400">
                <span className="text-sm italic">{t('errorLoading')}</span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    notif.status === 'unread' ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {typeIcon[notif.type] || '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug mb-0.5 ${
                      notif.status === 'unread' ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}>
                      {notif.title}
                    </p>
                    {notif.action_type === 'self_report' && notif.entry_id ? (
                      <div className="mt-2 mb-1">
                        <p className="text-sm text-gray-600 mb-2 italic border-l-2 border-gray-200 pl-2">
                          &quot;{notif.message}&quot;
                        </p>
                        <p className="text-xs font-medium text-gray-900 mb-2">
                          Это сбылось?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelfReport(notif.entry_id!, 'fulfilled'); }}
                            className="flex-1 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600"
                          >
                            ✅ Да
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelfReport(notif.entry_id!, 'partial'); }}
                            className="flex-1 py-1 text-xs bg-yellow-400 text-white rounded-lg hover:bg-yellow-500"
                          >
                            🔶 Частично
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelfReport(notif.entry_id!, 'unfulfilled'); }}
                            className="flex-1 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                          >
                            ❌ Нет
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  {notif.status === 'unread' && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </button>
              ))
            ) : (
              <div className="py-10 text-center text-gray-400">
                <span className="text-2xl block mb-2">🔔</span>
                <span className="text-sm italic">{t('empty')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
