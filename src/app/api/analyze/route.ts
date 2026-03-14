import { NextResponse } from "next/server";

// POST /api/analyze — Запуск AI-анализа записи через Claude API
export async function POST() {
  // TODO: Фаза 2, Шаг 09 — Claude API анализ
  return NextResponse.json(
    { error: "Не реализовано — Фаза 2" },
    { status: 501 }
  );
}
