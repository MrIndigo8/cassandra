import { Link } from '@/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Entry } from '@/types';
import { useTranslations } from 'next-intl';
import EntryReactions from './EntryReactions';
import { useUser } from '@/hooks/useUser';

// Расширенный тип записи для ленты (содержит автора)
export interface FeedEntry extends Omit<Entry, 'users'> {
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface EntryCardProps {
  entry: FeedEntry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const t = useTranslations('entry');
  const { user } = useUser();
  // Форматируем время создания
  const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ru });

  // Отрисовка точек интенсивности
  const renderIntensityDots = (intensity: number) => {
    return Array.from({ length: 10 }).map((_, i) => (
      <div 
        key={i} 
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ${i < intensity ? 'bg-primary' : 'bg-gray-200'}`} 
      />
    ));
  };

  return (
    <Link href={`/entry/${entry.id}`} className="block block group border-b border-gray-100 py-5 hover:bg-gray-50/50 transition-colors">
      <article className="flex flex-row gap-4">
        {/* Аватар (Слева) */}
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden text-white font-medium" aria-hidden="true">
          {entry.users?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.users.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>
              {(entry.users?.username || t('anonymous'))[0].toUpperCase()}
            </span>
          )}
        </div>

        {/* Контент (Справа) */}
        <div className="flex-1 min-w-0">
          {/* Шапка: Имя, время, бейдж */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900">{entry.users?.username || t('anonymous')}</span>
            <span className="text-sm text-gray-500">{timeAgo}</span>
            {entry.type && entry.type !== 'unknown' && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                entry.type === 'dream' 
                  ? 'bg-[#EFF6FF] text-secondary border-[#BAE6FD]' 
                  : entry.type === 'premonition' 
                    ? 'bg-[#ECFDF5] text-primary border-[#A7F3D0]'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {entry.type === 'dream' ? t('type.dream') : entry.type === 'premonition' ? t('type.premonition') : entry.type === 'feeling' ? t('type.feeling') : entry.type === 'vision' ? t('type.vision') : t('type.unknown')}
              </span>
            )}
          </div>

          {/* Заголовок */}
          <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">
            {entry.title.startsWith('Без заголовка') ? (
              <span className="text-gray-500 italic font-normal">{entry.title}</span>
            ) : (
              entry.title
            )}
          </h3>

          {/* Текст (макс 3 строки) */}
          <p className="text-gray-700 text-sm line-clamp-3 mb-2">
            {entry.content}
          </p>

          {/* Картинка (если есть) */}
          {entry.image_url && (
            <div className="mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.image_url}
                alt={t('imageAlt')}
                className="max-h-64 w-full object-cover rounded-xl border border-gray-100"
              />
            </div>
          )}

          <span className="text-sm text-gray-500 hover:text-gray-700 font-medium mb-3 inline-block transition-colors">
            {t('readMore')}
          </span>

          {/* Подвал: Интенсивность и статус */}
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-1" title={`${t('intensity')}: ${entry.intensity || 0}/10`}>
              {entry.intensity ? renderIntensityDots(entry.intensity) : null}
            </div>
          </div>
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="mt-2 text-left w-full">
            <EntryReactions 
              entryId={entry.id} 
              isAuthenticated={!!user}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
