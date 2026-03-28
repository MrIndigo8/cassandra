'use client';

import { Shield, Users, FileText, Sparkles, Settings, ClipboardList, Brain, Map, LayoutDashboard } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';

const roleBadgeClass: Record<string, string> = {
  architect: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  admin: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  moderator: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
};

export default function AdminSidebar({ role, username }: { role: string; username: string }) {
  const pathname = usePathname();
  const t = useTranslations('admin.sidebar');
  const tRole = useTranslations('role');

  const items = (
    [
      { href: '/admin', navKey: 'dashboard' as const, icon: LayoutDashboard, roles: ['architect', 'admin', 'moderator'] },
      { href: '/admin/users', navKey: 'users' as const, icon: Users, roles: ['architect', 'admin', 'moderator'] },
      { href: '/admin/entries', navKey: 'entries' as const, icon: FileText, roles: ['architect', 'admin', 'moderator'] },
      { href: '/admin/matches', navKey: 'matches' as const, icon: Sparkles, roles: ['architect', 'admin', 'moderator'] },
      { href: '/admin/settings', navKey: 'settings' as const, icon: Settings, roles: ['architect', 'admin'] },
      { href: '/admin/audit', navKey: 'audit' as const, icon: ClipboardList, roles: ['architect', 'admin', 'moderator'] },
      { href: '/admin/ai', navKey: 'ai' as const, icon: Brain, roles: ['architect', 'admin'] },
      { href: '/admin/map', navKey: 'map' as const, icon: Map, roles: ['architect', 'admin', 'moderator'] },
    ] as const
  ).filter((i) => i.roles.some((r) => r === role));

  const knownRoles = [
    'architect',
    'admin',
    'moderator',
    'observer',
    'chronicler',
    'sensitive',
    'oracle',
    'banned',
  ] as const;
  const roleLabel = (knownRoles as readonly string[]).includes(role)
    ? tRole(role as (typeof knownRoles)[number])
    : role;

  return (
    <aside className="w-64 border-r border-border bg-surface p-4">
      <div className="mb-6">
        <p className="text-lg font-bold text-text-primary">🏛 {t('brand')}</p>
        <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${roleBadgeClass[role] || 'border-border text-text-secondary'}`}>
          <Shield size={12} />
          {roleLabel}
        </div>
        <p className="mt-1 text-xs text-text-muted">@{username}</p>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.endsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                active ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:bg-bg hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {t(item.navKey)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-border pt-4">
        <Link href="/feed" className="text-sm text-text-secondary hover:text-text-primary">
          ← {t('backToSite')}
        </Link>
      </div>
    </aside>
  );
}
