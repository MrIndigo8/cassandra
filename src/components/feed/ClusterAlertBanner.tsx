'use client';

import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

export interface ClusterAlertProps {
  title: string;
  participants: number;
  intensity: number; // 0..1
  hoursAgo?: number;
}

export function ClusterAlertBanner({ title, participants, intensity, hoursAgo }: ClusterAlertProps) {
  const t = useTranslations('feed.clusterAlert');

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
        <span aria-hidden>🔮</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">
          {t('title')} · «{title}»
        </div>
        <div className="mt-0.5 text-xs text-text-secondary">
          {t('description', {
            participants,
            hours: hoursAgo ?? 50,
            intensity: intensity.toFixed(2),
          })}
        </div>
      </div>
      <Link
        href="/noosphere"
        className="btn-secondary whitespace-nowrap text-xs"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
