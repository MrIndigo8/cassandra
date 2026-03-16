'use client';

import Link from 'next/link';
import { useUser } from '@/hooks/useUser';

export function Header() {
  const { profile } = useUser();

  const initial = profile?.username
    ? profile.username[0].toUpperCase()
    : '?';

  const profileHref = profile?.username
    ? `/profile/${profile.username}`
    : '#';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-[680px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Логотип */}
        <Link href="/feed" className="font-semibold text-gray-900 text-base">
          🔮 Кассандра
        </Link>

        {/* Правая часть: кнопка + аватар */}
        <div className="flex items-center gap-3">
          {/* Аватар пользователя */}
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
