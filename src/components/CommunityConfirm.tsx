'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

interface CommunityConfirmProps {
  entryId: string;
  enabled: boolean;
  initialCount: number;
  patterns: string[];
  onCountChange?: (count: number) => void;
}

export default function CommunityConfirm({
  entryId,
  enabled,
  initialCount,
  patterns,
  onCountChange,
}: CommunityConfirmProps) {
  const t = useTranslations('entry');
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(() => patterns.slice(0, 8), [patterns]);
  const isCollective = count >= 5;

  const togglePattern = (pattern: string) => {
    setSelected((prev) => (prev.includes(pattern) ? prev.filter((p) => p !== pattern) : [...prev, pattern]));
  };

  const submit = async () => {
    if (!enabled || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/community-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, matched_patterns: selected }),
      });
      const data = await res.json();
      if (res.ok && typeof data?.count === 'number') {
        setCount(data.count);
        onCountChange?.(data.count);
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!enabled}
          className="text-sm text-primary hover:text-primary-hover disabled:opacity-60"
        >
          🔮 {t('communityConfirm')} ({count})
        </button>
        {isCollective && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {t('collectiveSignal')}
          </span>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-text-primary font-semibold mb-2">{t('communityModalTitle')}</h3>
            <p className="text-sm text-text-secondary mb-3">{t('communityModalHint')}</p>
            <div className="space-y-2 mb-4 max-h-56 overflow-auto">
              {options.length > 0 ? (
                options.map((pattern) => (
                  <label key={pattern} className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={selected.includes(pattern)}
                      onChange={() => togglePattern(pattern)}
                    />
                    <span>{pattern}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-text-muted">{t('communityModalNoPatterns')}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                {t('communityCancel')}
              </button>
              <button type="button" className="btn-primary" onClick={submit} disabled={loading || !enabled}>
                {loading ? '...' : t('communitySubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
