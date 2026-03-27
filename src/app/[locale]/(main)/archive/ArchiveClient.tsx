'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export type HistoricalCase = {
  id: string;
  title: string;
  title_en: string;
  person: string;
  date_of_vision: string;
  date_of_event: string;
  vision_text: string;
  vision_text_en: string;
  event_description: string;
  event_description_en: string;
  source_url: string;
  source_name: string;
  category: string;
  match_score: number;
  geography: string;
  is_verified: boolean;
  created_at: string;
};

export default function ArchiveClient({ initialCases }: { initialCases: HistoricalCase[] }) {
  const t = useTranslations('archive');
  const locale = useLocale();
  const [filter, setFilter] = useState('all');

  const categories = [
    { id: 'all', label: t('filters.all') },
    { id: 'aviation', label: t('filters.aviation') },
    { id: 'political', label: t('filters.political') },
    { id: 'natural', label: t('filters.natural') },
    { id: 'personal', label: t('filters.personal') },
    { id: 'war', label: t('filters.war') },
    { id: 'other', label: t('filters.other') },
  ];

  const filtered = filter === 'all' ? initialCases : initialCases.filter(c => c.category === filter);

  // Calculate days lag
  const getDaysLag = (d1: string, d2: string) => {
    const diffTime = Math.abs(new Date(d2).getTime() - new Date(d1).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filter === cat.id 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-surface text-text-secondary border border-border hover:border-primary/50 hover:text-text-primary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Cases List */}
      {filtered.length > 0 ? (
        <div className="space-y-6">
          {filtered.map(item => {
            const title = locale === 'en' ? item.title_en : item.title;
            const vision = locale === 'en' ? item.vision_text_en : item.vision_text;
            const eventDesc = locale === 'en' ? item.event_description_en : item.event_description;
            const lagDays = getDaysLag(item.date_of_vision, item.date_of_event);

            return (
              <div key={item.id} className="card border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">{title}</h2>
                    <div className="text-sm font-medium text-text-muted flex flex-wrap items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-text-secondary">
                        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {item.person}
                      </span>
                      <span className="text-border">•</span>
                      <span className="font-mono text-xs">{new Date(item.date_of_vision).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 bg-surface text-text-secondary text-[10px] uppercase font-bold tracking-wider rounded border border-border">
                      {/* Using the key as fallback if missing in translation */}
                      {t.has(`filters.${item.category}`) ? t(`filters.${item.category}`) : item.category}
                    </span>
                    {item.is_verified && (
                      <span className="p-1 bg-green-100 text-green-700 rounded-full" title="Verified Historical Case">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Vision Box */}
                <div className="relative pl-6 border-l-2 border-primary/30 mb-4 py-1">
                  <span className="absolute -left-[14px] top-1 w-6 h-6 bg-bg border-2 border-primary/30 rounded-full flex items-center justify-center text-[10px]">👁️</span>
                  <p className="text-text-secondary italic text-base">«{vision}»</p>
                </div>

                {/* Arrow Connector */}
                <div className="flex flex-col items-start pl-[5px]">
                  <svg className="w-4 h-6 text-text-muted animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </div>

                {/* Event Box */}
                <div className="relative pl-6 border-l-2 border-accent/50 mt-1 py-1">
                  <span className="absolute -left-[14px] top-1 w-6 h-6 bg-bg border-2 border-accent/50 rounded-full flex items-center justify-center text-[10px]">🎯</span>
                  <p className="text-text-primary font-medium mb-1 leading-relaxed">{eventDesc}</p>
                  <p className="text-xs font-mono text-text-muted">{new Date(item.date_of_event).toLocaleDateString(locale)}</p>
                </div>

                {/* Footer Meta */}
                <div className="mt-6 flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('lag', { days: lagDays })}
                  </div>
                  {item.source_url && (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 hover:underline flex items-center gap-1 font-medium transition-colors">
                      {t('source')} {item.source_name || "Link"}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-40 flex flex-col items-center justify-center bg-surface border border-border border-dashed rounded-xl text-text-muted">
          <span className="text-3xl mb-2">📚</span>
          <span className="text-sm italic">{t('empty')}</span>
        </div>
      )}
    </div>
  );
}
