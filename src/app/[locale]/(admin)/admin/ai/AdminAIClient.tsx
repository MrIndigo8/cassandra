'use client';

import { useState } from 'react';

export default function AdminAIClient() {
  const [running, setRunning] = useState<string | null>(null);

  const run = async (task: 'analyze' | 'verify' | 'cluster') => {
    setRunning(task);
    try {
      const res = await fetch('/api/admin/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      if (!res.ok) {
        // no-op, handled by visual status only
      }
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">AI мониторинг</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card border-border p-4">
          <h3 className="font-semibold text-text-primary">Анализ</h3>
          <button className="mt-3 rounded bg-primary px-3 py-2 text-sm text-white" onClick={() => void run('analyze')}>
            {running === 'analyze' ? 'Запуск...' : '▶ Запустить анализ'}
          </button>
        </div>
        <div className="card border-border p-4">
          <h3 className="font-semibold text-text-primary">Верификация</h3>
          <button className="mt-3 rounded bg-primary px-3 py-2 text-sm text-white" onClick={() => void run('verify')}>
            {running === 'verify' ? 'Запуск...' : '▶ Запустить верификацию'}
          </button>
        </div>
        <div className="card border-border p-4">
          <h3 className="font-semibold text-text-primary">Кластеризация</h3>
          <button className="mt-3 rounded bg-primary px-3 py-2 text-sm text-white" onClick={() => void run('cluster')}>
            {running === 'cluster' ? 'Запуск...' : '▶ Запустить кластеризацию'}
          </button>
        </div>
      </div>
    </div>
  );
}
