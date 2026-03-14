'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import type { EntryType } from '@/types';

export default function NewEntryPage() {
  const router = useRouter();
  
  const [type, setType] = useState<EntryType>('dream');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [intensity, setIntensity] = useState<number>(5);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (content.length < 50) {
      setError('Текст видения должен содержать минимум 50 символов (для качественного ИИ-анализа).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          title: title.trim() || 'Без заголовка (связанных событий не указано)',
          content,
          intensity,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при сохранении');
      }

      // Перенаправляем на страницу созданной записи
      if (result.data?.id) {
        router.push(`/entry/${result.data.id}`);
      } else {
        router.push('/feed');
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Произошла непредвиденная ошибка');
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Новая запись</h1>
          <p className="text-mist-dim font-mono text-sm uppercase tracking-wider">
            Фиксация сигнала в ноосфере
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          
          {/* Выбор типа */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('dream')}
              className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                type === 'dream' 
                  ? 'bg-cassandra-800/40 border-accent shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                  : 'bg-void border-void-border/50 hover:border-accent/40 text-mist-dim'
              }`}
            >
              <div className={`p-3 rounded-full ${type === 'dream' ? 'bg-accent/20 text-accent-light' : 'bg-void-border'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <span className="font-bold tracking-wide">СОН</span>
            </button>
            
            <button
              type="button"
              onClick={() => setType('premonition')}
              className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                type === 'premonition' 
                  ? 'bg-cassandra-800/40 border-[#D97706] shadow-[0_0_20px_rgba(217,119,6,0.3)]' 
                  : 'bg-void border-void-border/50 hover:border-[#D97706]/40 text-mist-dim'
              }`}
            >
              <div className={`p-3 rounded-full ${type === 'premonition' ? 'bg-[#D97706]/20 text-[#FCD34D]' : 'bg-void-border'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="font-bold tracking-wide">ПРЕДЧУВСТВИЕ</span>
            </button>
          </div>

          {/* Текст видения */}
          <div className="card glass relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <label className="label text-mist-light" htmlFor="content">Что вы видели?</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input min-h-[200px] resize-y scrollbar bg-void/50 focus:bg-void/80"
              placeholder="Опишите всё что помните, во всех деталях. Эмоции, образы, цвета, слова..."
              required
            />
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${content.length < 50 ? 'text-danger' : 'text-success'}`}>
                {content.length}/50 символов
              </span>
              <span className="text-xs text-mist-dim font-mono">
                AI ANALYSIS TARGET
              </span>
            </div>
          </div>

          {/* Связанные события (мапится на title) */}
          <div className="card glass">
            <label className="label text-mist-light" htmlFor="title">Связанные события (опционально)</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input bg-void/50 focus:bg-void/80"
              placeholder="Какие события в мире это может затрагивать? (Страны, люди, явления)"
            />
            <p className="text-xs text-mist-dim mt-2">
              Поможет ИИ быстрее найти совпадение в новостных потоках.
            </p>
          </div>

          {/* Интенсивность */}
          <div className="card glass">
            <div className="flex justify-between items-center mb-4">
              <label className="label mb-0 text-mist-light" htmlFor="intensity">Интенсивность сигнала</label>
              <div className="text-2xl font-black text-accent-light drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                {intensity}<span className="text-mist-dim text-lg">/10</span>
              </div>
            </div>
            <input
              id="intensity"
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="w-full accent-accent bg-void-border h-2 rounded-full appearance-none outline-none"
            />
            <div className="flex justify-between text-xs text-mist-dim mt-2 mt-4 font-mono pr-2 pl-2">
              <span>Призрачно</span>
              <span>Детально</span>
              <span>Гипер-реалистично</span>
            </div>
          </div>

          {/* Сабмит */}
          <button
            type="submit"
            disabled={loading || content.length < 50}
            className="btn-primary w-full py-4 text-lg mt-8 shadow-glow-md flex justify-center items-center gap-3 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Синхронизация...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Опубликовать сигнал</span>
              </>
            )}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
