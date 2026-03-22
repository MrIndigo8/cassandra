'use client';

import { useState } from 'react';

export function VerifyButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);

  const handleVerify = async () => {
    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/api/verify', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка верификации');
      }

      setStatus('done');
      setResult(`Проверено: ${data.checked ?? 0}, совпадений: ${data.matched ?? 0}`);
    } catch (err: unknown) {
      setStatus('error');
      setResult(err instanceof Error ? err.message : 'Неизвестная ошибка');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleVerify}
        disabled={status === 'loading'}
        className={`
          px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${status === 'loading'
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-primary text-white hover:bg-primary-hover active:scale-95'
          }
        `}
      >
        {status === 'loading' ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            Проверяю…
          </span>
        ) : (
          '⚡ Запустить верификацию'
        )}
      </button>

      {result && (
        <span className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {result}
        </span>
      )}
    </div>
  );
}
