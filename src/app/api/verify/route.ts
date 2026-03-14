import { NextResponse } from "next/server";

// POST /api/verify — Верификация совпадений записи с реальными событиями
// КРИТИЧЕСКОЕ ПРАВИЛО: event_date ОБЯЗАТЕЛЬНО > entry.created_at
export async function POST() {
  // TODO: Фаза 2, Шаг 10 — верификация
  return NextResponse.json(
    { error: "Не реализовано — Фаза 2" },
    { status: 501 }
  );
}
