'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'cassandra_last_digest_date';

type DigestResponse = {
  globalCoherence: number | null;
  streakCount: number;
  yesterdayEntry: { id: string; analyzed: boolean; summary: string } | null;
  platformMatches: { count: number; top: { id: string; title: string; score: number } | null };
  hotZone: { iso: string; avgAnxiety: number } | null;
};

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isMorningWindow() {
  const h = new Date().getHours();
  return h >= 8 && h < 12;
}

export default function MorningDigestBanner() {
  const t = useTranslations('morning');
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<DigestResponse | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMorningWindow()) return;
    if (localStorage.getItem(STORAGE_KEY) === getTodayKey()) return;

    fetch('/api/morning-digest')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return;
        setData(json);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  const coherenceText = useMemo(() => {
    if (!data) return '-';
    return data.globalCoherence === null ? t('coherenceUnavailable') : String(data.globalCoherence);
  }, [data, t]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, getTodayKey());
    setVisible(false);
  };

  if (!visible || !data) return null;

  return (
    <div className="card p-4 mb-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-text-primary font-semibold">{t('title')}</h3>
          <p className="text-sm text-text-secondary mt-1">{t('subtitle')}</p>
        </div>
        <button type="button" onClick={dismiss} className="text-text-muted hover:text-text-primary">
          ×
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <p className="text-text-secondary">{t('coherence')}: <span className="text-text-primary">{coherenceText}</span></p>
        <p className="text-text-secondary">{t('streak')}: <span className="text-text-primary">🔥 {data.streakCount}</span></p>
        <p className="text-text-secondary">{t('newMatches')}: <span className="text-text-primary">{data.platformMatches.count}</span></p>
        <p className="text-text-secondary">{t('hotZone')}: <span className="text-text-primary">{data.hotZone ? `${data.hotZone.iso} (${data.hotZone.avgAnxiety})` : '-'}</span></p>
      </div>
    </div>
  );
}
