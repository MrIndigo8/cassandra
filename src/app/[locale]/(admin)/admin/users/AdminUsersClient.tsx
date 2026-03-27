'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '@/components/admin/DataTable';
import ConfirmModal from '@/components/admin/ConfirmModal';

type AdminUser = {
  id: string;
  username: string;
  role: string;
  rating_score: number;
  total_entries: number;
  verified_count: number;
};

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<'ban' | 'unban' | 'reset_scoring' | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) query.set('search', search.trim());
    const res = await fetch(`/api/admin/users?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { users: AdminUser[] };
    setUsers(json.users || []);
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRunAction = async () => {
    if (!selected || !action) return;
    const res = await fetch(`/api/admin/users/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setSelected(null);
      setAction(null);
      await load();
    }
  };

  const columns = useMemo(
    () => [
      { key: 'username', header: 'Username' },
      { key: 'role', header: 'Роль' },
      { key: 'rating_score', header: 'Рейтинг' },
      { key: 'total_entries', header: 'Записей' },
      { key: 'verified_count', header: 'Матчи' },
      {
        key: 'actions',
        header: 'Действия',
        render: (row: AdminUser) => (
          <div className="flex gap-2">
            <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => { setSelected(row); setAction('reset_scoring'); }}>Скоринг</button>
            {row.role === 'banned' ? (
              <button className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300" onClick={() => { setSelected(row); setAction('unban'); }}>Разбан</button>
            ) : (
              <button className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300" onClick={() => { setSelected(row); setAction('ban'); }}>Бан</button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Пользователи</h1>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск username"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
        />
        <button className="rounded bg-primary px-3 py-2 text-sm text-white" onClick={() => void load()}>
          Найти
        </button>
      </div>
      <DataTable columns={columns} data={users} pagination={{ page, total: 999, onPageChange: setPage }} />

      <ConfirmModal
        open={Boolean(selected && action)}
        title="Подтверждение"
        message={`Выполнить действие "${action}" для ${selected?.username}?`}
        danger={action === 'ban'}
        onCancel={() => { setSelected(null); setAction(null); }}
        onConfirm={() => void onRunAction()}
      />
    </div>
  );
}
