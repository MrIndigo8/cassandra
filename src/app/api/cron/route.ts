import { NextResponse } from "next/server";

// GET /api/cron — Фоновые задачи по расписанию (Vercel Cron)
// Анализ новых записей, обновление кластеров, проверка событий
export async function GET() {
  // TODO: Фаза 2, Шаг 14 — cron задачи
  return NextResponse.json(
    { error: "Не реализовано — Фаза 2" },
    { status: 501 }
  );
}
