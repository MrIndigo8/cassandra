'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ExternalSignal } from '@/types';

export default function ExternalSignals() {
  const [signals, setSignals] = useState<ExternalSignal[]>([]);
  const [markets, setMarkets] = useState<ExternalSignal[]>([]);
  const [activeTab, setActiveTab] = useState<'reddit'|'polymarket'>('reddit');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('events');

  useEffect(() => {
    fetch('/api/external-sync')
      .then(r => {
        if (!r.ok) throw new Error('API Error');
        return r.json();
      })
      .then(data => {
        const all = data.latest || [];
        setSignals(all.filter((s: ExternalSignal) => s.source === 'reddit'));
        setMarkets(all.filter((s: ExternalSignal) => s.source === 'polymarket'));
        setError(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {t('externalSignalsTitle')}
      </h2>
      
      {error ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center text-sm text-red-600">
          {t('externalSignalsUnavailable')}
        </div>
      ) : loading ? (
        <div className="p-4 text-center text-sm text-gray-400">
          Загрузка...
        </div>
      ) : (
        <>
          {/* Табы */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('reddit')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                activeTab === 'reddit'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Reddit Dreams
            </button>
            <button
              onClick={() => setActiveTab('polymarket')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                activeTab === 'polymarket'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              📊 Polymarket
            </button>
          </div>

          {/* Reddit */}
          {activeTab === 'reddit' && (
            <div className="space-y-3">
              {signals.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Данные недоступны... Автоматическая загрузка настроена через /api/cron (или можно дёрнуть его вручную).
                </p>
              ) : signals.map(s => (
                <div key={s.id} className="border-b border-gray-100 pb-3">
                  <a 
                    href={s.url || undefined} 
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-green-600"
                  >
                    {s.title}
                  </a>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {s.content}
                  </p>
                  <span className="text-xs text-orange-400">
                    r/{s.metadata?.subreddit} · {s.metadata?.upvotes} upvotes
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Polymarket */}
          {activeTab === 'polymarket' && (
            <div className="space-y-3">
              {markets.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Данные пока недоступны. Ожидание первого запуска /api/cron.
                </p>
              ) : markets.map(m => (
                <div key={m.id} className="border-b border-gray-100 pb-3">
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.round(m.metadata?.probability * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-green-600">
                      {Math.round(m.metadata?.probability * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
