'use client';

import { useState } from 'react';
import { Link } from '@/navigation';
import type { Entry } from '@/types';
import EntryComments from '@/components/EntryComments';
import EntryReactions from '@/components/EntryReactions';
import MatchDetail from '@/components/MatchDetail';
import type { MatchData } from '@/lib/matches';
import { useUser } from '@/hooks/useUser';
import { useTranslations } from 'next-intl';

// Расширенный тип, включающий автора
interface EntryWithUser extends Omit<Entry, 'users'> {
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface EntryClientProps {
  entry: EntryWithUser;
  match: MatchData | null;
}

export function EntryClient({ entry, match }: EntryClientProps) {
  const t = useTranslations('entry');
  const [copied, setCopied] = useState(false);
  const { user, profile } = useUser();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDream = entry.type === 'dream';

  // Точки интенсивности
  const renderIntensityDots = (intensity: number) => {
    return Array.from({ length: 10 }).map((_, i) => (
      <div 
        key={i} 
        className={`w-2 h-2 rounded-full ${i < intensity ? 'bg-primary' : 'bg-surface-hover'}`} 
      />
    ));
  };

  return (
    <div className="max-w-[680px] mx-auto py-8 px-4">
      {/* Кнопка назад */}
      <Link href="/feed" className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('backToFeed')}
      </Link>

      {/* Хедер записи */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            isDream ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            {isDream ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
            {isDream ? t('type.dream') : t('type.premonition')}
          </div>
        </div>

        <div className="text-text-muted font-mono text-xs text-right">
          <div className="font-medium text-text-primary mb-0.5">{entry.users?.username || t('anonymous')}</div>
          {new Date(entry.created_at).toLocaleString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit'
          })}
        </div>
      </div>

      {/* Главная карточка */}
      <div className="border-b border-border pb-8 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-text-primary">
            {entry.title.startsWith('Без заголовка') ? (
              <span className="text-text-muted italic">{entry.title}</span>
            ) : (
              entry.title
            )}
          </h1>
          
          {entry.intensity && (
            <div className="flex flex-col items-end shrink-0 ml-4">
              <span className="text-[10px] uppercase font-mono text-text-muted tracking-widest leading-none mb-1">{t('intensity')}</span>
              <div className="flex items-center gap-1">
                {renderIntensityDots(entry.intensity)}
              </div>
            </div>
          )}
        </div>

        <p className="text-text-secondary text-base leading-relaxed whitespace-pre-wrap">
          {entry.content}
        </p>

        {entry.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image_url}
            alt={t('imageAlt')}
            className="mt-6 w-full max-h-96 object-cover rounded-xl border border-border"
          />
        )}

        {match && (
          <div className="mt-6">
            <MatchDetail
              match={match}
              entry={{
                id: entry.id,
                title: entry.title,
                content: entry.content,
                type: entry.type,
                created_at: entry.created_at,
                user: entry.users
                  ? {
                      username: entry.users.username,
                      avatar_url: entry.users.avatar_url,
                      role: 'observer',
                    }
                  : undefined,
              }}
              variant="full"
              showEntryLink={false}
              showEventLink
            />
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <EntryReactions entryId={entry.id} isAuthenticated={!!user} />
          <EntryComments 
            entryId={entry.id} 
            isAuthenticated={!!user}
            currentUsername={profile?.username}
          />
        </div>
      </div>

      {/* Действия */}
      <div className="flex justify-end">
        <button 
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-primary/50 text-text-secondary hover:text-text-primary transition-all active:scale-95 bg-surface"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-primary">{t('linkCopied')}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {t('shareSignal')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
