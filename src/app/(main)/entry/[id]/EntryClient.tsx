'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Entry } from '@/types';

// Расширенный тип, включающий автора
interface EntryWithUser extends Entry {
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface EntryClientProps {
  entry: EntryWithUser;
}

export function EntryClient({ entry }: EntryClientProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDream = entry.type === 'dream';
  
  let statusStr = "Ожидает анализа";
  let statusColor = "bg-gray-50 text-gray-500 border-gray-200";
  let statusIcon = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  if (entry.ai_analyzed_at) {
    statusStr = "Проанализировано";
    statusColor = "bg-[#ECFDF5] text-primary border-[#A7F3D0]";
    statusIcon = (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  // Точки интенсивности
  const renderIntensityDots = (intensity: number) => {
    return Array.from({ length: 10 }).map((_, i) => (
      <div 
        key={i} 
        className={`w-2 h-2 rounded-full ${i < intensity ? 'bg-primary' : 'bg-gray-200'}`} 
      />
    ));
  };

  return (
    <div className="max-w-[680px] mx-auto py-8 px-4">
      {/* Кнопка назад */}
      <Link href="/feed" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Вернуться в ленту
      </Link>

      {/* Хедер записи */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            isDream ? 'bg-[#EFF6FF] text-secondary border-[#BAE6FD]' : 'bg-[#ECFDF5] text-primary border-[#A7F3D0]'
          }`}>
            {isDream ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
            {isDream ? 'Сон' : 'Предчувствие'}
          </div>
          <div className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center gap-1.5 flex-shrink-0 ${statusColor}`}>
            {statusIcon}
            {statusStr}
          </div>
        </div>

        <div className="text-gray-500 font-mono text-xs text-right">
          <div className="font-medium text-gray-900 mb-0.5">{entry.users?.username || 'Аноним'}</div>
          {new Date(entry.created_at).toLocaleString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit'
          })}
        </div>
      </div>

      {/* Главная карточка */}
      <div className="border-b border-gray-100 pb-8 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {entry.title.startsWith('Без заголовка') ? (
              <span className="text-gray-400 italic">{entry.title}</span>
            ) : (
              entry.title
            )}
          </h1>
          
          {entry.intensity && (
            <div className="flex flex-col items-end shrink-0 ml-4">
              <span className="text-[10px] uppercase font-mono text-gray-500 tracking-widest leading-none mb-1">Интенсивность</span>
              <div className="flex items-center gap-1">
                {renderIntensityDots(entry.intensity)}
              </div>
            </div>
          )}
        </div>

        <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap">
          {entry.content}
        </p>
      </div>

      {/* AI результаты */}
      <div className="border border-gray-100 rounded-lg p-6 bg-surface mb-8">
        <h3 className="font-mono text-sm tracking-widest text-primary uppercase mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          Ноосферный резонанс
        </h3>
        
        {entry.ai_analyzed_at ? (
          <div className="space-y-4 text-sm text-gray-700">
            {entry.ai_summary && <p className="italic border-l-2 border-primary/30 pl-3">{entry.ai_summary}</p>}
            
            {entry.ai_images && entry.ai_images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {entry.ai_images.map((sym, i) => (
                  <span key={i} className="px-2 py-0.5 bg-surface rounded text-xs text-gray-700 border border-border">#{sym}</span>
                ))}
              </div>
            )}
            
            {entry.ai_emotions && entry.ai_emotions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {entry.ai_emotions.map((em, i) => (
                  <span key={`em-${i}`} className="px-2 py-0.5 bg-red-50/50 rounded text-xs text-red-700 border border-red-100">
                    {em}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              {entry.ai_scale && (
                <div>Масштаб: <span className="font-medium text-gray-700">{entry.ai_scale}</span></div>
              )}
              {entry.ai_geography && (
                <div>Локация: <span className="font-medium text-gray-700">{entry.ai_geography}</span></div>
              )}
              {entry.ai_specificity !== null && entry.ai_specificity !== undefined && (
                <div>Специфичность: <span className="font-medium text-gray-700">{entry.ai_specificity.toFixed(1)}/1.0</span></div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm italic py-4">
            Искусственный интеллект анализирует архетипы и образы. Возвращайтесь позже, чтобы увидеть расшифровку.
          </div>
        )}
      </div>

      {/* Действия */}
      <div className="flex justify-end">
        <button 
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-700 transition-all active:scale-95 bg-white"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-primary">Ссылка скопирована</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Поделиться сигналом
            </>
          )}
        </button>
      </div>
    </div>
  );
}
