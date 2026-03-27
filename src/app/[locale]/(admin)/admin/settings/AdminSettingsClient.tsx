'use client';

import { useEffect, useState } from 'react';
import FeatureToggle from '@/components/admin/FeatureToggle';

type SettingRow = { key: string; value: { enabled?: boolean; [k: string]: unknown } };

export default function AdminSettingsClient() {
  const [settings, setSettings] = useState<SettingRow[]>([]);

  const load = async () => {
    const res = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { settings: SettingRow[] };
    setSettings(json.settings || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const setFlag = async (key: string, enabled: boolean) => {
    const current = settings.find((s) => s.key === key);
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: { ...(current?.value || {}), enabled } }),
    });
    await load();
  };

  const featureRows = settings.filter((s) => s.key.startsWith('features.'));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Настройки системы</h1>
      <div className="card border-border p-4">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Разделы</h2>
        <div className="space-y-2">
          {featureRows.map((row) => (
            <FeatureToggle
              key={row.key}
              label={row.key.replace('features.', '')}
              enabled={Boolean(row.value?.enabled)}
              onToggle={(enabled) => void setFlag(row.key, enabled)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
