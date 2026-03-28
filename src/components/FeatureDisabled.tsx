'use client';

import { useTranslations } from 'next-intl';

export type FeatureNavKey = 'feed' | 'discoveries' | 'archive' | 'map';

export function FeatureDisabled({ navKey }: { navKey: FeatureNavKey }) {
  const t = useTranslations('features.disabled');
  const tNav = useTranslations('nav');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-4 text-4xl" aria-hidden>
        🔒
      </div>
      <h2 className="mb-2 text-xl font-bold text-text-primary">{t('title')}</h2>
      <p className="text-text-secondary max-w-md">
        {t('description', { section: tNav(navKey) })}
      </p>
    </div>
  );
}
