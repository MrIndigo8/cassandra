'use client';

import { useRouter, usePathname } from '@/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FeedFilterKey } from '@/lib/feed/feedFilters';
import { getEntryTypePresentation } from '@/lib/entryTypePresentation';

const FILTERS: Array<{ key: FeedFilterKey; labelKey: string }> = [
  { key: 'all', labelKey: 'filters.all' },
  { key: 'mine', labelKey: 'filters.mine' },
  { key: 'community', labelKey: 'filters.community' },
  { key: 'verified', labelKey: 'filters.verified' },
  { key: 'clusters', labelKey: 'filters.clusters' },
];

const TYPE_KEYS = ['dream', 'premonition', 'feeling', 'vision', 'anxiety', 'synchronicity'] as const;

export function FeedFilters({ currentFilter }: { currentFilter: FeedFilterKey }) {
  const t = useTranslations('feed');
  const tEntry = useTranslations('entry');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentType = sp.get('type');

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => setParam('filter', f.key === 'all' ? null : f.key)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            currentFilter === f.key
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border bg-surface text-text-secondary hover:border-primary/50 hover:text-text-primary'
          }`}
        >
          {t(f.labelKey)}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      {TYPE_KEYS.map((type) => {
        const p = getEntryTypePresentation(type, (key) => tEntry(key as Parameters<typeof tEntry>[0]));
        const active = currentType === type;
        return (
          <button
            key={type}
            onClick={() => setParam('type', active ? null : type)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              active
                ? 'border-primary text-text-primary'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="mr-1">{p.icon}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
