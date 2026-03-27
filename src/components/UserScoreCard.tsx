'use client';

import { useTranslations } from 'next-intl';

interface UserScoreCardProps {
  ratingScore: number;
  role: string;
  verifiedCount: number;
  totalEntries: number;
  nextRole?: {
    nextRole: string;
    progress: number;
    hint: string;
  } | null;
}

export default function UserScoreCard({
  ratingScore,
  role,
  verifiedCount,
  totalEntries,
  nextRole,
}: UserScoreCardProps) {
  const t = useTranslations('scoring');
  const tRole = useTranslations('role');

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary">{tRole(role)}</h3>
          <p className="text-sm text-text-secondary">{t('yourStatus')}</p>
        </div>
        <div className="text-3xl font-bold text-primary">{ratingScore.toFixed(1)}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
        <div>
          <div className="text-xl font-semibold text-text-primary">{totalEntries}</div>
          <div className="text-xs text-text-muted">{t('entries')}</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-text-primary">{verifiedCount}</div>
          <div className="text-xs text-text-muted">{t('matches')}</div>
        </div>
        <div>
          <div className="text-xl font-semibold text-text-primary">{ratingScore.toFixed(1)}</div>
          <div className="text-xs text-text-muted">{t('rating')}</div>
        </div>
      </div>

      {nextRole && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary">
              {t('nextRole')}: {tRole(nextRole.nextRole)}
            </span>
            <span className="font-medium text-text-primary">{Math.round(nextRole.progress * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.round(nextRole.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">{nextRole.hint}</p>
        </div>
      )}
    </div>
  );
}
