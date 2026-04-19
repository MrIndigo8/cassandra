'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { EntryCard, type FeedEntry } from '@/components/EntryCard';
import MatchDetail from '@/components/MatchDetail';
import type { MatchData } from '@/lib/matches';
import { LogoutButton } from './LogoutButton';

interface ProfileClientProps {
  locale: string;
  profileUsername: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    location: string | null;
    is_public: boolean;
    role: string;
    rating_score: number;
    verified_count: number;
    total_entries: number;
    total_matches: number;
    streak_count: number;
    avg_specificity: number | null;
    avg_lag_days: number | null;
    dominant_images: string[] | null;
    created_at: string;
  };
  entries: FeedEntry[];
  matches: MatchData[];
  matchEntries: Record<
    string,
    {
      id: string;
      title: string | null;
      content: string;
      type: string;
      created_at: string;
      user?: {
        username: string;
        avatar_url: string | null;
        role: string;
        rating_score: number;
      };
    }
  >;
  nextRole: { nextRole: string; progress: number; hint: string } | null;
  typeCounts: Record<string, number>;
  isOwnProfile: boolean;
  achievements: Array<{ id: string; icon: string; key: string }>;
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/80 p-4 text-center shadow-sm ring-1 ring-white/[0.03] transition-colors hover:border-primary/25">
      <div className="text-2xl font-mono font-bold tabular-nums text-text-primary">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted mt-1.5">{label}</div>
    </div>
  );
}

function roleBadgeClass(role: string): string {
  if (role === 'architect') return 'badge-role-oracle border-amber-500/40';
  if (role === 'admin' || role === 'moderator') return 'badge-role-sensitive';
  if (role === 'oracle') return 'badge-role-oracle';
  if (role === 'sensitive') return 'badge-role-sensitive';
  if (role === 'chronicler') return 'badge-role-chronicler';
  return 'badge-role-observer';
}

const ROLE_AVATAR_ICON: Record<string, string> = {
  architect: '🏛',
  admin: '🛡',
  moderator: '🧭',
  oracle: '⭐',
  sensitive: '〰️',
  chronicler: '📖',
  observer: '👁',
  banned: '⛔',
};

function EmptyEntries({
  isOwnProfile,
  username,
  totalAccount,
  listedCount,
}: {
  isOwnProfile: boolean;
  username: string;
  totalAccount: number;
  listedCount: number;
}) {
  const t = useTranslations('profile');
  const tFeed = useTranslations('feed');

  if (totalAccount > 0 && listedCount === 0) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-6 py-10 text-center">
        <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto leading-relaxed">{t('entriesLoadHint')}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          {t('refreshPage')}
        </button>
      </div>
    );
  }

  if (isOwnProfile) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 px-6 py-12 text-center">
        <p className="text-text-secondary mb-5 max-w-sm mx-auto">{t('noEntries')}</p>
        <Link href="/feed" className="btn-primary inline-flex">
          {tFeed('newSignal')}
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/50 bg-surface/40 px-6 py-12 text-center text-text-muted">
      <p>{t('noEntriesOther', { username })}</p>
    </div>
  );
}

export default function ProfileClient({
  locale,
  profileUsername,
  profile,
  entries: initialEntries,
  matches,
  matchEntries,
  nextRole,
  typeCounts,
  isOwnProfile,
  achievements,
}: ProfileClientProps) {
  const t = useTranslations('profile');
  const tRole = useTranslations('role');
  const tEntry = useTranslations('entry');
  const tCommon = useTranslations('common');
  const tFeed = useTranslations('feed');
  const uiLocale = useLocale();
  const dateLocale = uiLocale === 'en' ? enUS : ru;

  const [tab, setTab] = useState<'entries' | 'matches' | 'about'>('entries');
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [offset, setOffset] = useState(initialEntries.length);
  const [hasMore, setHasMore] = useState(initialEntries.length >= 20);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (initialEntries.length > 0 || profile.total_entries === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/profile/entries?username=${encodeURIComponent(profileUsername)}&offset=0&limit=20`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { entries?: FeedEntry[]; hasMore?: boolean };
        const next = data.entries || [];
        if (next.length > 0 && !cancelled) {
          setEntries(next);
          setOffset(next.length);
          setHasMore(Boolean(data.hasMore));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialEntries.length, profile.total_entries, profileUsername]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: profile.full_name || profile.display_name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    is_public: profile.is_public,
  });

  const displayTitle = profile.full_name || profile.display_name || profile.username;
  const canAccessAdmin = ['architect', 'admin', 'moderator'].includes(profile.role);

  const formatMemberSince = useMemo(
    () => format(new Date(profile.created_at), 'LLLL yyyy', { locale: dateLocale }),
    [profile.created_at, dateLocale]
  );
  const formatMemberSinceLong = useMemo(
    () => format(new Date(profile.created_at), 'd MMMM yyyy', { locale: dateLocale }),
    [profile.created_at, dateLocale]
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/profile/entries?username=${encodeURIComponent(profileUsername)}&offset=${offset}&limit=20`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: FeedEntry[]; hasMore?: boolean };
      const next = data.entries || [];
      setEntries((prev) => [...prev, ...next]);
      setOffset((o) => o + next.length);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }, [offset, profileUsername]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const hasFile = Boolean(avatarFile);
      if (hasFile && avatarFile) {
        const form = new FormData();
        form.set('full_name', editForm.full_name.trim());
        form.set('bio', editForm.bio.trim());
        form.set('location', editForm.location.trim());
        form.set('is_public', editForm.is_public ? 'true' : 'false');
        form.set('avatar', avatarFile);
        const res = await fetch('/api/profile', { method: 'PATCH', body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: unknown };
          setSaveError(typeof data.error === 'string' ? data.error : tCommon('errors.generic'));
          return;
        }
      } else {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: editForm.full_name.trim(),
            bio: editForm.bio.trim(),
            location: editForm.location.trim(),
            is_public: editForm.is_public,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: unknown };
          setSaveError(typeof data.error === 'string' ? data.error : tCommon('errors.generic'));
          return;
        }
      }
      setEditing(false);
      setAvatarFile(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  const showAboutTab = isOwnProfile || profile.total_entries >= 20 || Object.keys(typeCounts).length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-surface via-surface to-background/90 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)]">
        <div className="h-24 sm:h-28 bg-gradient-to-r from-primary/25 via-violet-500/10 to-transparent" />
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 -mt-10 sm:-mt-11">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-8">
            <div className="relative shrink-0 mx-auto sm:mx-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-background object-cover shadow-lg shadow-black/40"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-background bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center text-3xl font-bold text-primary shadow-lg shadow-black/30">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
              <div
                className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-sm shadow-sm ${
                  profile.role === 'architect'
                    ? 'bg-amber-500 text-white'
                    : profile.role === 'admin'
                      ? 'bg-violet-500 text-white'
                      : profile.role === 'moderator'
                        ? 'bg-sky-500 text-white'
                        : profile.role === 'oracle'
                          ? 'bg-amber-400 text-white'
                          : profile.role === 'sensitive'
                            ? 'bg-purple-500 text-white'
                            : profile.role === 'chronicler'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-600 text-white'
                }`}
              >
                {ROLE_AVATAR_ICON[profile.role] ?? '👁'}
              </div>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left space-y-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-text-primary">
                  {displayTitle}
                </h1>
                <p className="text-sm text-text-muted mt-0.5">@{profile.username}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-sm text-text-secondary">
                {profile.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>📍</span>
                    {profile.location}
                  </span>
                ) : null}
                {profile.streak_count > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>🔥</span>
                    {profile.streak_count} {t('days')}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>📅</span>
                  {t('since', { date: formatMemberSince })}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className={roleBadgeClass(profile.role)}>{tRole(profile.role)}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-sm font-mono text-primary">
                  <span aria-hidden>⚡</span>
                  {profile.rating_score.toFixed(1)}
                </span>
              </div>

              {profile.bio ? (
                <p className="text-sm text-text-secondary leading-relaxed max-w-xl mx-auto sm:mx-0 border-t border-border/40 pt-4">
                  {profile.bio}
                </p>
              ) : null}

              {isOwnProfile ? (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveError(null);
                      setEditing(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface-hover/80 px-3 py-2 text-sm font-medium text-text-primary hover:border-primary/40 hover:bg-surface-hover transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 opacity-80" />
                    {t('edit')}
                  </button>
                  {canAccessAdmin ? (
                    <>
                      <Link
                        href="/admin"
                        className="inline-flex items-center rounded-lg border border-primary/35 bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/25 transition-colors"
                      >
                        Admin
                      </Link>
                      <Link
                        href="/admin/settings"
                        className="inline-flex items-center rounded-lg border border-border/70 bg-surface-hover/50 px-3 py-2 text-sm text-text-secondary hover:border-primary/30 hover:text-text-primary transition-colors"
                      >
                        {t('settings')}
                      </Link>
                    </>
                  ) : null}
                  <LogoutButton />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-8">
        <StatBox label={t('entries')} value={profile.total_entries} />
        <StatBox label={t('matches')} value={profile.verified_count} />
        <StatBox label={t('rating')} value={profile.rating_score.toFixed(1)} />
        <StatBox
          label={t('avgLagShort')}
          value={profile.avg_lag_days != null ? `${profile.avg_lag_days.toFixed(0)}d` : '—'}
        />
      </div>

      {achievements.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">{t('achievementsTitle')}</h3>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/60 px-3 py-1.5 text-xs text-text-primary"
              >
                <span aria-hidden>{a.icon}</span>
                {t(`achievements.${a.key}`)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {nextRole && !['oracle', 'architect'].includes(profile.role) ? (
        <div className="mt-8 rounded-xl border border-border/50 bg-surface/60 p-5 sm:p-6 shadow-sm ring-1 ring-white/[0.03]">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary">
              {t('nextRoleLabel')}:{' '}
              <span className="text-text-primary font-medium">{tRole(nextRole.nextRole)}</span>
            </span>
            <span className="font-mono text-primary">{Math.round(nextRole.progress * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700"
              style={{ width: `${Math.round(nextRole.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">{nextRole.hint}</p>
        </div>
      ) : null}

      <div className="mt-8 inline-flex flex-wrap gap-1 rounded-xl border border-border/50 bg-surface/40 p-1">
        {(
          [
            ['entries', t('tabs.entries')],
            ['matches', t('tabs.matches')],
            ...(showAboutTab ? ([['about', t('tabs.about')]] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entries' ? (
        <div className="space-y-4 mt-6">
          {entries.length === 0 ? (
            <EmptyEntries
              isOwnProfile={isOwnProfile}
              username={profile.username}
              totalAccount={profile.total_entries}
              listedCount={entries.length}
            />
          ) : (
            entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))
          )}
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="btn-ghost w-full py-3"
            >
              {loadingMore ? tCommon('loading') : tFeed('loadMore')}
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'matches' ? (
        <div className="space-y-4 mt-6">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <div className="text-3xl mb-3" aria-hidden>
                🔮
              </div>
              <p>{t('noMatchesYet')}</p>
            </div>
          ) : (
            matches.map((match) => {
              const en = matchEntries[match.entry_id];
              const entryForDetail = en
                ? {
                    id: en.id,
                    title: en.title,
                    content: en.content,
                    type: en.type,
                    created_at: en.created_at,
                    user: en.user
                      ? {
                          username: en.user.username,
                          avatar_url: en.user.avatar_url,
                          role: en.user.role,
                        }
                      : undefined,
                  }
                : undefined;
              return (
                <MatchDetail
                  key={match.id}
                  match={match}
                  entry={entryForDetail}
                  variant="compact"
                  showEntryLink
                  showEventLink
                />
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'about' && showAboutTab ? (
        <div className="space-y-6 mt-6">
          {profile.total_entries >= 20 ? (
            <div className="bg-surface rounded-xl border border-border/30 p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span aria-hidden>🧠</span> {t('predictiveProfile')}
              </h3>
              {profile.dominant_images && profile.dominant_images.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-text-muted mb-1">{t('dominantSymbols')}</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.dominant_images.slice(0, 8).map((img) => (
                      <span key={img} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                        {img}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {profile.avg_lag_days != null ? (
                <p className="text-sm text-text-secondary">
                  {t('avgLagText', { days: profile.avg_lag_days.toFixed(0) })}
                </p>
              ) : null}
              {profile.avg_specificity != null ? (
                <p className="text-sm text-text-secondary mt-1">
                  {t('specificityText', { value: Math.round(profile.avg_specificity * 100) })}
                </p>
              ) : null}
            </div>
          ) : null}

          {Object.keys(typeCounts).length > 0 ? (
            <div className="bg-surface rounded-xl border border-border/30 p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{t('entryTypes')}</h3>
              {Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const typeKey = ['dream', 'premonition', 'feeling', 'vision', 'unknown'].includes(type)
                    ? type
                    : 'unknown';
                  return (
                    <div key={type} className="flex items-center justify-between py-1.5">
                      <span className={`badge-type-${typeKey} text-xs`}>{tEntry(`type.${typeKey}` as 'type.dream')}</span>
                      <span className="text-sm font-mono text-text-muted">{count}</span>
                    </div>
                  );
                })}
            </div>
          ) : null}

          <div className="bg-surface rounded-xl border border-border/30 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('info')}</h3>
            <div className="space-y-2 text-sm text-text-secondary">
              {profile.location ? (
                <p>
                  <span aria-hidden>📍</span> {profile.location}
                </p>
              ) : null}
              <p>
                <span aria-hidden>📅</span> {t('memberSince', { date: formatMemberSinceLong })}
              </p>
              <p>
                <span aria-hidden>📝</span> {t('totalEntries', { count: profile.total_entries })}
              </p>
              <p>
                <span aria-hidden>🔮</span> {t('totalMatches', { count: profile.verified_count })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-text-primary mb-4">{t('editProfile')}</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden text-lg font-bold text-primary">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
                ) : profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  profile.username[0].toUpperCase()
                )}
              </div>
              <label className="btn-ghost text-sm cursor-pointer">
                {t('changeAvatar')}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted">{t('fullName')}</label>
                <input
                  className="input w-full mt-1"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">{t('bio')}</label>
                <textarea
                  className="input w-full mt-1 h-20 resize-none"
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  maxLength={200}
                />
                <p className="text-xs text-text-muted text-right mt-1">{editForm.bio.length}/200</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">{t('location')}</label>
                <input
                  className="input w-full mt-1"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  maxLength={100}
                  placeholder={locale === 'en' ? 'City, Country' : 'Город, страна'}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-secondary">{t('publicProfile')}</span>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, is_public: !f.is_public }))}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                    editForm.is_public ? 'bg-primary' : 'bg-border'
                  }`}
                  aria-pressed={editForm.is_public}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      editForm.is_public ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            {saveError ? (
              <p className="mt-4 text-sm text-red-400" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1">
                {tCommon('cancel')}
              </button>
              <button type="button" onClick={() => void saveProfile()} className="btn-primary flex-1" disabled={saving}>
                {saving ? tCommon('saving') : tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
