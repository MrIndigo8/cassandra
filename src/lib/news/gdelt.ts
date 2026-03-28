// ============================================================
// Новостные API — GDELT Project (заготовка)
// Документация: https://www.gdeltproject.org/
//
// Сейчас fetchAllEvents в index.ts не вызывает этот модуль — события идут из
// NewsAPI, USGS, Guardian. Когда будете подключать GDELT:
// 1) уточните актуальный HTTP API (2.x Doc API / BigQuery и т.д.);
// 2) добавьте парсинг под NewsEvent в ./types;
// 3) подключите вызов в fetchAllEvents и лимиты по ключу/квоте.
// ============================================================

import { NewsEvent } from './types';

export async function fetchGdeltEvents(): Promise<NewsEvent[]> {
  return [];
}
