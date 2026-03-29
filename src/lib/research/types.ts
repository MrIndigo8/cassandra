/**
 * Типы для будущего публичного Research API (агрегаты без персональных данных).
 * Не включать: содержимое записей, user_id, полный emotional_spectrum.
 */
export interface PublicGeoSnapshot {
  country_iso: string;
  period: string;
  dominant_emotion: string;
  anxiety_level: number;
  dominant_archetype: string;
  dominant_narrative: string;
  entry_count: number;
  unique_users: number;
}

export interface PublicGlobalSnapshot {
  date: string;
  global_anxiety: number;
  global_coherence: number;
  dominant_emotion: string;
  dominant_archetype: string;
  regional_beliefs: Record<string, string>;
  countries_active: number;
  total_users: number;
}
