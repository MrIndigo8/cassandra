import { createServerSupabaseClient } from '@/lib/supabase/server';
import Image from 'next/image';
import { Link } from '@/navigation';
import { notFound } from 'next/navigation';
import { ProfileEditor } from './ProfileEditor';
import { LogoutButton } from './LogoutButton';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { username: string } }) {
  return {
    title: `@${params.username} | Кассандра`,
    description: `Профиль пользователя @${params.username}`,
  };
}

const ROLE_LABELS = {
  observer: { labelKey: 'observer', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: '👁️' },
  chronicler: { labelKey: 'chronicler', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '📝' },
  sensitive: { labelKey: 'sensitive', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '🔮' },
  oracle: { labelKey: 'oracle', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⚡' },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const t = await getTranslations('profile');
  const supabase = createServerSupabaseClient();

  // Текущий пользователь
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Профиль по username
  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', params.username)
    .single();

  if (error || !profile) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-20 text-center">
        <span className="text-5xl mb-4 block">👻</span>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('userNotFound')}</h1>
        <p className="text-gray-500">{t('doesNotExist', { username: params.username })}</p>
        <Link href="/feed" className="mt-4 inline-block text-primary hover:underline text-sm">
          {t('backToFeed')}
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  // Записи пользователя (последние 10)
  const { data: entries } = await supabase
    .from('entries')
    .select('id, content, type, created_at, best_match_score, ai_images')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Совпадения пользователя
  const { data: matches } = await supabase
    .from('matches')
    .select('id, event_title, event_url, event_source, event_date, similarity_score, entry_id, explanation')
    .eq('user_id', profile.id)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false })
    .limit(10);

  // Статистика
  const { count: totalEntries } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  const { count: confirmedMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .gt('similarity_score', 0.6);

  const roleData = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.observer;
  const initial = profile.username[0].toUpperCase();

  return (
    <div className="max-w-[680px] mx-auto px-4 py-8">
      {/* Шапка профиля */}
      <div className="flex items-start gap-5 mb-8">
        {/* Аватар */}
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.username}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            initial
          )}
        </div>

        {/* Инфо */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.display_name || profile.username}
            </h1>
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${roleData.color}`}>
              {roleData.icon} {t(`roles.${roleData.labelKey}`)}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-2">@{profile.username}</p>
          {profile.bio && (
            <p className="text-gray-600 text-sm mb-2">{profile.bio}</p>
          )}
          <p className="text-xs text-gray-400">
            {t('registered', { date: formatDate(profile.created_at) })}
          </p>

          {isOwnProfile && (
            <div>
              <ProfileEditor
                userId={profile.id}
                currentDisplayName={profile.display_name || ''}
              />
              <LogoutButton />
            </div>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalEntries || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('entries')}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{confirmedMatches || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('matches')}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{(profile.rating || 0).toFixed(1)}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('rating')}</div>
        </div>
      </div>

      {/* Совпадения */}
      {matches && matches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {t('confirmedMatches')}
          </h2>
          <div className="space-y-2">
            {matches.map((match: Record<string, unknown>) => (
              <div
                key={match.id as string}
                className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <span className="text-base">🔮</span>
                <div className="flex-1 min-w-0">
                  {match.event_url ? (
                    <a
                      href={match.event_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-primary line-clamp-1"
                    >
                      {match.event_title as string}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">
                      {match.event_title as string}
                    </span>
                  )}
                  <div className="text-xs text-gray-400">
                    {match.event_source as string} · {formatDateShort(match.event_date as string)}
                  </div>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-lg text-sm font-bold bg-green-100 text-green-700">
                  {Math.round((match.similarity_score as number) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние записи */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          {t('recentEntries')}
        </h2>
        {entries && entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry: Record<string, unknown>) => {
              const content = entry.content as string;
              const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;
              const bestScore = entry.best_match_score as number | null;

              return (
                <Link
                  key={entry.id as string}
                  href={`/entry/${entry.id}`}
                  className="block bg-white border border-gray-100 rounded-lg px-4 py-3 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">
                      {formatDateShort(entry.created_at as string)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100">
                      {entry.type as string}
                    </span>
                    {bestScore && bestScore > 0.6 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-100">
                        ✓ {Math.round(bestScore * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{preview}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 text-sm italic">
            {t('noEntriesYet')}
          </div>
        )}
      </div>
    </div>
  );
}
