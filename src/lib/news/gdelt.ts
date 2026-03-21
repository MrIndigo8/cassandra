// ============================================================
// Новостные API — GDELT Project
// Поиск событий мирового масштаба
// ============================================================

import { NewsEvent } from './types';

// TODO: Фаза 3 — реализация GDELT
export async function fetchGdeltEvents(): Promise<NewsEvent[]> {
  // GDELT — запланировано для Фазы 3
  // Пока возвращаем пустой массив чтобы не ломать fetchAllEvents
  console.log('[GDELT] Источник не активен — используем NewsAPI и USGS');
  return [];
}
