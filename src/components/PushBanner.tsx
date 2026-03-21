'use client';

import { useState, useEffect } from 'react';
import { requestPushPermission } from '@/lib/push';

const STORAGE_KEY = 'cassandra_push_banner_dismissed';

/**
 * Одноразовый баннер для включения утренних push-напоминаний.
 * Показывается один раз, потом скрывается навсегда через localStorage.
 */
export function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    // Не показывать если уже отклонили или нет поддержки
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;

    // Показываем баннер с небольшой задержкой
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setEnabling(true);
    await requestPushPermission();
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 animate-fade-in">
      <span className="text-2xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">
          Включить утренние напоминания?
        </p>
        <p className="text-xs text-gray-500">
          Каждое утро в 7:00 мы напомним записать сон пока помните
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {enabling ? '...' : 'Включить'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          Не сейчас
        </button>
      </div>
    </div>
  );
}
