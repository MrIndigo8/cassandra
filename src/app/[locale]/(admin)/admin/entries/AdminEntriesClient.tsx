'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/admin/DataTable';
import ConfirmModal from '@/components/admin/ConfirmModal';

type AdminEntry = {
  id: string;
  title: string | null;
  content: string;
  type: string;
  scope: string | null;
  anxiety_score: number | null;
  is_quarantine: boolean;
  is_verified: boolean;
  users?: { username?: string } | null;
};

export default function AdminEntriesClient() {
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [openDelete, setOpenDelete] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/entries?page=1&limit=20', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { entries: AdminEntry[] };
    setEntries(json.entries || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const doPatch = async (entry_id: string, action: string) => {
    await fetch('/api/admin/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id, action }),
    });
    await load();
  };

  const doDelete = async () => {
    if (!pendingId) return;
    await fetch('/api/admin/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: pendingId, reason: 'admin delete' }),
    });
    setOpenDelete(false);
    setPendingId(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Записи</h1>
      <DataTable
        data={entries}
        columns={[
          { key: 'author', header: 'Автор', render: (r: AdminEntry) => r.users?.username || 'unknown' },
          { key: 'title', header: 'Заголовок', render: (r: AdminEntry) => r.title || r.content.slice(0, 50) },
          { key: 'type', header: 'Тип' },
          { key: 'scope', header: 'Scope' },
          { key: 'anxiety_score', header: 'Тревога' },
          {
            key: 'status',
            header: 'Статус',
            render: (r: AdminEntry) => (r.is_quarantine ? 'Карантин' : r.is_verified ? 'Верифицировано' : 'Обычная'),
          },
          {
            key: 'actions',
            header: 'Действия',
            render: (r: AdminEntry) => (
              <div className="flex gap-2">
                <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => void doPatch(r.id, r.is_quarantine ? 'unquarantine' : 'quarantine')}>
                  {r.is_quarantine ? 'Снять карантин' : 'Карантин'}
                </button>
                <button className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300" onClick={() => { setPendingId(r.id); setOpenDelete(true); }}>
                  Удалить
                </button>
              </div>
            ),
          },
        ]}
      />
      <ConfirmModal
        open={openDelete}
        title="Удалить запись?"
        message="Действие необратимо."
        danger
        onCancel={() => setOpenDelete(false)}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
