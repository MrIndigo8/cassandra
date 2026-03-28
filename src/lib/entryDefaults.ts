/** Значения по умолчанию для заголовка записи (совпадают с возможными вставками в API). */
export const DEFAULT_ENTRY_TITLE_RU = 'Без заголовка';
export const DEFAULT_ENTRY_TITLE_EN = 'Untitled';

const PLACEHOLDER_PREFIXES = [DEFAULT_ENTRY_TITLE_RU, DEFAULT_ENTRY_TITLE_EN] as const;

export function isPlaceholderEntryTitle(title: string): boolean {
  return PLACEHOLDER_PREFIXES.some((p) => title.startsWith(p));
}
