'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@/hooks/useUser';

export function ConsentBanner() {
  const { user, profile } = useUser();
  const t = useTranslations('consent');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user || !profile || profile.consent_accepted_at || dismissed) {
    return null;
  }

  const accept = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept_consent: true }),
      });
      if (res.ok) {
        setDismissed(true);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-0">
      <div className="rounded-2xl border border-border bg-surface shadow-xl p-4 md:p-5">
        <p className="text-sm text-text-primary font-medium mb-1">{t('title')}</p>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">{t('body')}</p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void accept()}
          className="btn-primary w-full text-sm py-2.5 disabled:opacity-60"
        >
          {loading ? t('saving') : t('accept')}
        </button>
      </div>
    </div>
  );
}
