'use client';


import { useUser } from '@/hooks/useUser';
import { NotificationBell } from './NotificationBell';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/navigation';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

import { Logo } from './Logo';

export function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tRole = useTranslations('role');
  const locale = useLocale();
  const { profile } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleLocaleChange = (newLocale: string) => {
    localStorage.setItem('locale', newLocale);
    
    // Защита от дублирования 'en/en/feed' в случае рассинхрона роутера
    let cleanPath = pathname;
    if (cleanPath.startsWith('/en/') || cleanPath === '/en') {
      cleanPath = cleanPath.replace(/^\/en/, '') || '/';
    }
    if (cleanPath.startsWith('/ru/') || cleanPath === '/ru') {
      cleanPath = cleanPath.replace(/^\/ru/, '') || '/';
    }
    
    router.replace(cleanPath, { locale: newLocale });
  };

  const initial = profile?.username
    ? profile.username[0].toUpperCase()
    : '?';

  const profileHref = profile?.username
    ? `/profile/${profile.username}`
    : '#';

  const streakValue = Number(profile?.streak_count ?? profile?.streak ?? 0);
  const currentRole = profile?.role || 'observer';
  const currentRating = Number(profile?.rating_score ?? 0);
  const roleColor =
    currentRole === 'architect'
      ? 'bg-amber-400'
      : currentRole === 'admin'
      ? 'bg-violet-400'
      : currentRole === 'moderator'
      ? 'bg-sky-400'
      : currentRole === 'oracle'
      ? 'bg-amber-500'
      : currentRole === 'sensitive'
      ? 'bg-violet-500'
      : currentRole === 'chronicler'
      ? 'bg-blue-500'
      : currentRole === 'banned'
      ? 'bg-red-500'
      : 'bg-gray-400';

  const navLinks = [
    { href: '/feed', label: t('feed') },
    { href: '/discoveries', label: t('discoveries') },
    { href: '/map', label: t('map') },
  ];
  const canAccessAdmin = ['architect', 'admin', 'moderator'].includes(currentRole);

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border backdrop-blur">
      <div className="max-w-[1024px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Логотип */}
        <Link href="/feed" className="flex items-center gap-2.5 font-display font-bold text-text-primary text-lg tracking-tight hover:opacity-80 transition-opacity">
          <Logo className="w-7 h-7" />
          {tCommon('appName')}
        </Link>

        {/* Центральная часть: навигация */}
        <div className="hidden md:flex flex-1 justify-center items-center gap-4">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {canAccessAdmin && (
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors ${
                pathname.startsWith('/admin') ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Правая часть: streak + уведомления + локаль + аватар */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost inline-flex items-center justify-center w-8 h-8"
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {/* Свитчер языка */}
          <div className="flex items-center bg-surface-hover rounded-full p-1 border border-border">
            <button
              onClick={() => handleLocaleChange('ru')}
              aria-label={tCommon('switchLanguageRu', { fallback: 'Переключить на русский' })}
              className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                locale === 'ru' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => handleLocaleChange('en')}
              aria-label={tCommon('switchLanguageEn', { fallback: 'Switch to English' })}
              className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                locale === 'en' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              EN
            </button>
          </div>

          {/* Streak badge */}
          {streakValue > 0 && (
            <span
              className="text-sm font-bold text-orange-500 flex items-center gap-0.5"
              title={`Серия: ${streakValue} дней подряд`}
            >
              🔥 {streakValue}
            </span>
          )}
          <NotificationBell />
          <span
            className={`inline-flex w-2.5 h-2.5 rounded-full ${roleColor}`}
            title={`${tRole(currentRole)} · ${currentRating.toFixed(1)}`}
            aria-label={`${tRole(currentRole)} ${currentRating.toFixed(1)}`}
          />
          <Link
            href={profileHref}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium hover:bg-primary-hover transition-colors shrink-0"
            title={profile?.username || tCommon('profile')}
            aria-label={profile?.username || tCommon('profile')}
          >
            <span aria-hidden="true">{initial}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
