/**
 * Единое отображение типа записи (иконка-эмодзи + Tailwind-классы + ключ перевода).
 * `t` — из useTranslations('entry'), вызывать как t('type.dream') через обёртку ниже.
 */
export type EntryTypeBadge = { icon: string; cls: string; label: string };

export function getEntryTypePresentation(
  type: string | null | undefined,
  t: (key: string) => string
): EntryTypeBadge {
  const ty = type || 'unknown';
  if (ty === 'dream') {
    return { icon: '🌙', cls: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30', label: t('type.dream') };
  }
  if (ty === 'premonition') {
    return { icon: '⚡', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', label: t('type.premonition') };
  }
  if (ty === 'feeling') {
    return { icon: '💜', cls: 'bg-pink-500/20 text-pink-300 border border-pink-500/30', label: t('type.feeling') };
  }
  if (ty === 'vision') {
    return { icon: '👁', cls: 'bg-violet-500/20 text-violet-300 border border-violet-500/30', label: t('type.vision') };
  }
  if (ty === 'anxiety') {
    return { icon: '😰', cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30', label: t('type.anxiety') };
  }
  if (ty === 'thought') {
    return { icon: '💭', cls: 'bg-slate-500/20 text-slate-200 border border-slate-500/30', label: t('type.thought') };
  }
  if (ty === 'deja_vu') {
    return { icon: '🔁', cls: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30', label: t('type.deja_vu') };
  }
  if (ty === 'sensation') {
    return { icon: '✨', cls: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30', label: t('type.sensation') };
  }
  if (ty === 'mood') {
    return { icon: '🎭', cls: 'bg-teal-500/20 text-teal-300 border border-teal-500/30', label: t('type.mood') };
  }
  if (ty === 'synchronicity') {
    return { icon: '🔗', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30', label: t('type.synchronicity') };
  }
  return { icon: '❓', cls: 'bg-surface-hover text-text-secondary border border-border', label: t('type.unknown') };
}
