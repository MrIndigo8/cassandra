'use client';

import { useEffect, useState } from 'react';
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Админ-панель</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Пользователи" value={data?.users.total ?? '—'} change={`+${data?.users.newToday ?? 0} сегодня`} />
        <StatCard title="Записи" value={data?.entries.total ?? '—'} change={`+${data?.entries.today ?? 0} сегодня`} />
        <StatCard title="Совпадения" value={data?.matches.total ?? '—'} change={`+${data?.matches.thisWeek ?? 0} неделя`} />
        <StatCard title="Ср. тревога" value={data?.entries.avgAnxietyScore ?? '—'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card border-border p-4">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Топ-10 пользователей</h2>
          <DataTable
            loading={loading}
            data={((data?.users.topByRating || []) as Array<Record<string, unknown>>)}
            columns={[
              { key: 'username', header: 'Username' },
              { key: 'role', header: 'Роль' },
              { key: 'rating_score', header: 'Рейтинг' },
              { key: 'verified_count', header: 'Матчи' },
              { key: 'total_entries', header: 'Записи' },
            ]}
          />
        </div>
        <div className="card border-border p-4">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Система</h2>
          <div className="space-y-2 text-sm">
            <p className="text-text-secondary">AI очередь: {data?.ai.entriesAwaitingAnalysis ?? '—'}</p>
            <p className="text-text-secondary">Активные кластеры: {data?.ai.clustersActive ?? '—'}</p>
            <p className="text-text-secondary">Переводов в кэше: {data?.ai.translationsCached ?? '—'}</p>
            <p className="text-text-secondary">Карантин записей: {data?.entries.quarantined ?? '—'}</p>
            <div className="mt-3">
              <p className="mb-1 text-text-primary">Feature toggles:</p>
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
