'use client';


import { useUser } from '@/hooks/useUser';
import { NotificationBell } from './NotificationBell';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/navigation';

export function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { profile } = useUser();
  const pathname = usePathname();
  const router = useRouter();

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

  const streak = (profile as Record<string, unknown> | null)?.streak as number | undefined;

  const navLinks = [
    { href: '/feed', label: t('feed') },
    { href: '/events', label: t('events') },
    { href: '/archive', label: t('archive') },
    { href: '/noosphere', label: t('noosphere') },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-[1024px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Логотип */}
        <Link href="/feed" className="font-semibold text-gray-900 text-base">
          🔮 {tCommon('appName')}
        </Link>

        {/* Центральная часть: навигация */}
        <div className="flex-1 flex justify-center items-center gap-4">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href ? 'text-primary' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Правая часть: streak + уведомления + локаль + аватар */}
        <div className="flex items-center gap-4">
          {/* Свитчер языка */}
          <div className="flex items-center bg-gray-50 rounded-full p-1 border border-gray-100">
            <button
              onClick={() => handleLocaleChange('ru')}
              className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                locale === 'ru' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => handleLocaleChange('en')}
              className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                locale === 'en' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              EN
            </button>
          </div>

          {/* Streak badge */}
          {streak && streak >= 3 && (
            <span
              className="text-sm font-bold text-orange-500 flex items-center gap-0.5"
              title={`Серия: ${streak} дней подряд`}
            >
              🔥 {streak}
            </span>
          )}
          <NotificationBell />
          <Link
            href={profileHref}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium hover:bg-primary-hover transition-colors shrink-0"
            title={profile?.username || t('profile')}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
