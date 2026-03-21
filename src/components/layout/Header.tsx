'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { profile } = useUser();
  const pathname = usePathname();

  const initial = profile?.username
    ? profile.username[0].toUpperCase()
    : '?';

  const profileHref = profile?.username
    ? `/profile/${profile.username}`
    : '#';

  const streak = (profile as Record<string, unknown> | null)?.streak as number | undefined;

  const navLinks = [
    { href: '/feed', label: 'Лента' },
    { href: '/events', label: 'События' },
    { href: '/noosphere', label: 'Ноосфера' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-[1024px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Логотип */}
        <Link href="/feed" className="font-semibold text-gray-900 text-base">
          🔮 Кассандра
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

        {/* Правая часть: streak + уведомления + аватар */}
        <div className="flex items-center gap-2">
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
            title={profile?.username || 'Профиль'}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
