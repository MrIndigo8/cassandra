'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/admin/DataTable';

type MatchRow = {
  id: string;
  similarity_score: number;
  event_title: string;
  entries?: { title?: string; users?: { username?: string } } | null;
};

export default function AdminMatchesClient() {
  const [rows, setRows] = useState<MatchRow[]>([]);

  const load = async () => {
    const res = await fetch('/api/admin/matches?page=1&limit=50', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { matches: MatchRow[] };
    setRows(json.matches || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    await fetch('/api/admin/matches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Совпадения</h1>
      <DataTable
        data={rows}
        columns={[
          { key: 'author', header: 'Автор', render: (r: MatchRow) => r.entries?.users?.username || '—' },
          { key: 'entry', header: 'Запись', render: (r: MatchRow) => r.entries?.title || '—' },
          { key: 'event_title', header: 'Событие' },
          { key: 'similarity_score', header: 'Score', render: (r: MatchRow) => `${Math.round((r.similarity_score || 0) * 100)}%` },
          {
            key: 'actions',
            header: 'Действия',
            render: (r: MatchRow) => (
              <button className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300" onClick={() => void remove(r.id)}>
                Удалить
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
