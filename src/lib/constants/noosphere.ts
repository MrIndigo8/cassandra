/** Совпадения на карте по умолчанию: последние N дней; старше — «архив» (другой период в фильтре). */
export const NOOSPHERE_MATCH_ACTIVE_DAYS = 23;

/** Теплокарта и «смысл» тревожности региона: только сигналы за последние N дней. */
export const NOOSPHERE_ANXIETY_WINDOW_DAYS = 7;

/** Мин. тревожность для учёта в heatmap. */
export const NOOSPHERE_ANXIETY_MIN_SCORE = 3;

/** Типы угроз, считающиеся «негативным оттенком» (дополнительно к тревожности). */
export const NOOSPHERE_NEGATIVE_THREAT_TYPES = [
  'conflict',
  'disaster',
  'health',
  'economic',
] as const;

export type NoosphereMatchPeriod =
  | '7d'
  | '23d'
  | '90d'
  | '365d'
  | 'archive'
  | 'all';

export function parseNoosphereMatchPeriod(raw: string | null): NoosphereMatchPeriod {
  if (
    raw === '7d' ||
    raw === '23d' ||
    raw === '90d' ||
    raw === '365d' ||
    raw === 'archive' ||
    raw === 'all'
  ) {
    return raw;
  }
  return '23d';
}
