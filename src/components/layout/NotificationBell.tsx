'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setNotifications(data as Notification[]);
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
          (payload: { new: Record<string, unknown> }) => {
            const newNotif = payload.new as unknown as Notification;
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
    const entryId = notif.data?.entry_id;
    if (entryId) {
      router.push(`/entry/${entryId}`);
      setIsOpen(false);
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
            {notifications.length > 0 ? (
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
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {notif.message}
                    </p>
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
                <span className="text-sm italic">Пока тихо... Пиши больше сигналов</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
