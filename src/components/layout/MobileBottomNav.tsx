'use client';

import { Globe2, Home, PenLine, Sparkles, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useUser } from '@/hooks/useUser';

export function MobileBottomNav() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const { profile } = useUser();

  const profileHref = profile?.username ? `/profile/${profile.username}` : '/feed';

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0)] shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.35)]">
      <div className="max-w-[1024px] mx-auto grid grid-cols-5 items-end gap-0 px-1 pt-1">
        <Link
          href="/feed"
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
            isActive('/feed') ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Home size={18} />
          <span className="text-[11px] leading-none">{t('feed')}</span>
        </Link>
        <Link
          href="/map"
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
            isActive('/map') ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Globe2 size={18} />
          <span className="text-[11px] leading-none">{t('map')}</span>
        </Link>
        <div className="flex justify-center pb-1">
          <Link
            href="/feed#entry-composer-anchor"
            className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-[0_8px_28px_-4px_rgba(99,102,241,0.55)] hover:brightness-110 transition-all active:scale-95"
            aria-label={t('writeSignal')}
            title={t('writeSignal')}
          >
            <PenLine size={22} strokeWidth={2} />
          </Link>
        </div>
        <Link
          href="/discoveries"
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
            isActive('/discoveries') ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Sparkles size={18} />
          <span className="text-[11px] leading-none">{t('discoveries')}</span>
        </Link>
        <Link
          href={profileHref}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
            pathname.startsWith('/profile') ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <UserRound size={18} />
          <span className="text-[11px] leading-none">{tCommon('profile')}</span>
        </Link>
      </div>
    </nav>
  );
}
