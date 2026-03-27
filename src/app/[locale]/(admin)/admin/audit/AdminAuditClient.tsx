'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/admin/DataTable';

type AuditRow = {
  id: string;
  action_type: string;
  created_at: string;
  admin?: { username?: string } | null;
  target_user?: { username?: string } | null;
};

export default function AdminAuditClient() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/audit?page=1&limit=50', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { actions: AuditRow[] };
      setRows(json.actions || []);
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Аудит-лог</h1>
      <DataTable
        data={rows}
        columns={[
          { key: 'created_at', header: 'Время' },
          { key: 'admin', header: 'Админ', render: (r: AuditRow) => r.admin?.username || '—' },
          { key: 'action_type', header: 'Действие' },
          { key: 'target_user', header: 'Цель', render: (r: AuditRow) => r.target_user?.username || '—' },
        ]}
      />
    </div>
  );
}
