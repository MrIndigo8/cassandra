'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import StatCard from '@/components/admin/StatCard';
import DataTable from '@/components/admin/DataTable';

type DashboardData = {
  users: { total: number; newToday: number; topByRating: Array<Record<string, unknown>> };
  entries: { total: number; today: number; avgAnxietyScore: number; quarantined: number };
  matches: { total: number; thisWeek: number };
  system: { features: Record<string, boolean> };
  ai: { entriesAwaitingAnalysis: number; clustersActive: number; translationsCached: number };
};

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch('/api/admin/stats', { cache: 'no-store' });
    if (!res.ok) return;
    setData((await res.json()) as DashboardData);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, []);

  const em = '—';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('statUsers')}
          value={data?.users.total ?? em}
          change={t('newToday', { count: data?.users.newToday ?? 0 })}
        />
        <StatCard
          title={t('statEntries')}
          value={data?.entries.total ?? em}
          change={t('newToday', { count: data?.entries.today ?? 0 })}
        />
        <StatCard
          title={t('statMatches')}
          value={data?.matches.total ?? em}
          change={t('newWeek', { count: data?.matches.thisWeek ?? 0 })}
        />
        <StatCard title={t('statAnxiety')} value={data?.entries.avgAnxietyScore ?? em} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card border-border p-4">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">{t('topUsers')}</h2>
          <DataTable
            loading={loading}
            data={((data?.users.topByRating || []) as Array<Record<string, unknown>>)}
            columns={[
              {
                key: 'username',
                header: t('colUsername'),
                render: (row: Record<string, unknown>) => {
                  const u = String(row.username ?? '');
                  return (
                    <Link href={`/profile/${u}`} className="text-primary hover:underline">
                      @{u}
                    </Link>
                  );
                },
              },
              { key: 'role', header: t('colRole') },
              { key: 'rating_score', header: t('colRating') },
              { key: 'verified_count', header: t('colMatches') },
              { key: 'total_entries', header: t('colEntries') },
            ]}
          />
        </div>
        <div className="card border-border p-4">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">{t('system')}</h2>
          <div className="space-y-2 text-sm">
            <p className="text-text-secondary">
              {data?.ai ? t('aiQueue', { count: data.ai.entriesAwaitingAnalysis }) : em}
            </p>
            <p className="text-text-secondary">
              {data?.ai ? t('activeClusters', { count: data.ai.clustersActive }) : em}
            </p>
            <p className="text-text-secondary">
              {data?.ai ? t('translationsCached', { count: data.ai.translationsCached }) : em}
            </p>
            <p className="text-text-secondary">
              {data?.entries
                ? t('quarantine', { count: data.entries.quarantined ?? 0 })
                : em}
            </p>
            <div className="mt-3">
              <p className="mb-1 text-text-primary">{t('featureToggles')}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data?.system.features || {}).map(([key, enabled]) => (
                  <span key={key} className={`rounded-full px-2 py-1 text-xs ${enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {key}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
