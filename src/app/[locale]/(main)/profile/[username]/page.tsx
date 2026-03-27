import { createServerSupabaseClient } from '@/lib/supabase/server';
import Image from 'next/image';
import { Link } from '@/navigation';
import { ProfileEditor } from './ProfileEditor';
import { LogoutButton } from './LogoutButton';
import { getTranslations } from 'next-intl/server';
import UserScoreCard from '@/components/UserScoreCard';
import { getProgressToNextRole } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { username: string } }) {
  return {
    title: `@${params.username} | Кассандра`,
    description: `Профиль пользователя @${params.username}`,
  };
}

const ROLE_LABELS = {
  architect: { labelKey: 'architect', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '🏛' },
  admin: { labelKey: 'admin', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', icon: '🛡' },
  moderator: { labelKey: 'moderator', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', icon: '🧭' },
  observer: { labelKey: 'observer', color: 'bg-surface-hover text-text-secondary border-border', icon: '👁️' },
  chronicler: { labelKey: 'chronicler', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '📝' },
  sensitive: { labelKey: 'sensitive', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', icon: '🔮' },
  oracle: { labelKey: 'oracle', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '⚡' },
  banned: { labelKey: 'banned', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '⛔' },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const t = await getTranslations('profile');
  const supabase = createServerSupabaseClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase.from('users').select('*').eq('username', params.username).single();

  if (error || !profile) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-20 text-center">
        <span className="text-5xl mb-4 block">👻</span>
        <h1 className="text-2xl font-bold text-text-primary mb-2">{t('userNotFound')}</h1>
        <p className="text-text-secondary">{t('doesNotExist', { username: params.username })}</p>
        <Link href="/feed" className="mt-4 inline-block text-primary hover:underline text-sm">
          {t('backToFeed')}
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  const { data: entries } = await supabase
    .from('entries')
    .select('id, content, type, created_at, best_match_score, prediction_potential')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: matches } = await supabase
    .from('matches')
    .select('id, event_title, event_url, event_source, event_date, similarity_score')
    .eq('user_id', profile.id)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false })
    .limit(10);

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
  const totalEntriesNum = totalEntries || 0;
  const confirmedMatchesNum = confirmedMatches || 0;
  const rating = Number(profile.rating_score || 0);
  const streak = Number(profile.streak_count || 0);
  const accuracy = totalEntriesNum > 0 ? Math.round((confirmedMatchesNum / totalEntriesNum) * 100) : 0;
  const avgLagDays = Number(profile.avg_lag_days || 0);
  const nextRole = getProgressToNextRole(rating, Number(profile.verified_count || 0), totalEntriesNum, String(profile.role || 'observer'));
  const strongPatterns = Array.isArray(profile.dominant_images) ? profile.dominant_images.slice(0, 3) : [];
  const canAccessAdmin = ['architect', 'admin', 'moderator'].includes(String(profile.role || 'observer'));

  return (
    <div className="max-w-[860px] mx-auto px-4 py-8">
      <div className="card p-5 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.username} width={80} height={80} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-text-primary">{profile.display_name || profile.username}</h1>
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${roleData.color}`}>
                {roleData.icon} {t(`roles.${roleData.labelKey}`)}
              </span>
            </div>
            <p className="text-text-secondary text-sm mb-2">@{profile.username}</p>
            {profile.bio && <p className="text-text-secondary text-sm mb-2">{profile.bio}</p>}
            <p className="text-xs text-text-muted">{t('registered', { date: formatDate(profile.created_at) })}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span>🔥 {streak} {t('streak')}</span>
              <span>•</span>
              <span>{t('accuracy')}: {accuracy}%</span>
              <span>•</span>
              <span>{t('avgLag')}: {avgLagDays.toFixed(1)}d</span>
            </div>

            {isOwnProfile && (
              <div>
                <ProfileEditor userId={profile.id} currentDisplayName={profile.display_name || ''} />
                {canAccessAdmin && (
                  <Link
                    href="/admin"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    🏛 Админ-панель
                  </Link>
                )}
                <LogoutButton />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">{totalEntriesNum}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{t('entries')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{confirmedMatchesNum}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{t('matches')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{rating.toFixed(1)}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{t('rating')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">{accuracy}%</div>
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{t('accuracy')}</div>
        </div>
      </div>

      <UserScoreCard
        ratingScore={rating}
        role={String(profile.role || 'observer')}
        verifiedCount={Number(profile.verified_count || 0)}
        totalEntries={totalEntriesNum}
        nextRole={nextRole}
      />

      {totalEntriesNum >= 20 && (
        <div className="card p-4 mt-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-2">{t('predictiveProfile')}</h2>
          <p className="text-sm text-text-secondary">{t('strongSide')}: {strongPatterns.length ? strongPatterns.join(', ') : t('noDataYet')}</p>
          <p className="text-sm text-text-secondary mt-1">{t('avgLag')}: {avgLagDays.toFixed(1)}d</p>
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="mb-8 mt-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {t('confirmedMatches')}
          </h2>
          <div className="space-y-2">
            {matches.map((match: Record<string, unknown>) => (
              <div key={match.id as string} className="card px-4 py-3 flex items-center gap-3">
                <span className="text-base">🔮</span>
                <div className="flex-1 min-w-0">
                  {match.event_url ? (
                    <a
                      href={match.event_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-text-primary hover:text-primary line-clamp-1"
                    >
                      {match.event_title as string}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-text-primary line-clamp-1">{match.event_title as string}</span>
                  )}
                  <div className="text-xs text-text-muted">
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

      <div>
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          {t('recentEntries')}
        </h2>
        {entries && entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry: Record<string, unknown>) => {
              const content = entry.content as string;
              const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;
              const bestScore = entry.best_match_score as number | null;
              return (
                <Link key={entry.id as string} href={`/entry/${entry.id}`} className="block card px-4 py-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-text-muted font-mono">{formatDateShort(entry.created_at as string)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-hover text-text-secondary rounded border border-border">
                      {entry.type as string}
                    </span>
                    {bestScore && bestScore > 0.6 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-100">
                        ✓ {Math.round(bestScore * 100)}%
                      </span>
                    )}
                    {Number(entry.prediction_potential || 0) > 0.7 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                        🔮 {t('highPotential')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{preview}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center bg-surface border border-border border-dashed rounded-xl text-text-muted text-sm italic">
            {t('noEntriesYet')}
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="card p-4 mt-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-3">{t('settings')}</h2>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>• {t('settingsPublic')}</p>
            <p>• {t('settingsPush')}</p>
            <p>• {t('settingsTheme')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
