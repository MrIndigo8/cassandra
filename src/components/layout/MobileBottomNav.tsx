'use client';

import { Globe2, Home, Sparkles, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useUser } from '@/hooks/useUser';

export function MobileBottomNav() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const { profile } = useUser();

  const profileHref = profile?.username ? `/profile/${profile.username}` : '/feed';

  const items = [
    { href: '/feed', label: t('feed'), icon: Home },
    { href: '/discoveries', label: t('discoveries'), icon: Sparkles },
    { href: '/map', label: t('map'), icon: Globe2 },
    { href: profileHref, label: tCommon('profile'), icon: UserRound, startsWith: '/profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
      <div className="max-w-[1024px] mx-auto px-2 py-1 grid grid-cols-4 gap-1">
        {items.map((item) => {
          const active = item.startsWith
            ? pathname.startsWith(item.startsWith)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
                active ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon size={18} />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
