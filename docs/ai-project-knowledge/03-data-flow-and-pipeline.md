# Поток данных и связь процессов

Документ описывает, как подсистемы **сцеплены в одну цепочку**: от действия пользователя до агрегатов, уведомлений и админки.

## 1. Создание записи (пользователь)

1. UI (форма записи, например на `/feed`) → **`POST /api/entries`** (`src/app/api/entries/route.ts`).
2. Валидация (`createEntrySchema`), антиспам (`checkSpam`), вставка в **`entries`** (тип по умолчанию **`unknown`** до анализа).
3. При включённом анализе — синхронный вызов Claude (`analyzeEntry` / `applyClaudeAnalysisToEntry`), обновление полей записи.
4. После успешного анализа — **`scheduleTouchpoints`** → строки в **`notifications`** со статусом **`scheduled`** (`src/lib/engagement/schedule-touchpoints.ts`).

## 2. Отложенный анализ и глубина

- **`POST /api/analyze`** (cron или ручной вызов с секретом) → `runAnalysis` / `runAnalysisForEntryIds` → **`deep_analysis`**, обновление **`symbolic_fingerprints`** (`updateFingerprint` и др.).
- Возможна **гонка**: немедленный вызов `/api/analyze` после создания записи и обработка той же записи cron’ом — учитывать идемпотентность и порядок обновлений.

## 3. Ежедневный оркестратор (`/api/cron`)

Файл: `src/app/api/cron/route.ts`.

**Последовательно (критичные шаги):**

1. `/api/external-sync`
2. `/api/analyze` (critical)
3. `/api/verify` (critical)
4. `/api/coherence` (critical)

**Параллельно:**

- `/api/cluster`
- `/api/recalculate-scores`
- `/api/reality-snapshot`

**Затем последовательно:**

- `/api/admin/generate-snapshots` — агрегация **`geo_snapshots`**, **`global_snapshots`**
- `/api/process-touchpoints` — перевод **`scheduled`** уведомлений в **`unread`** с генерацией текста
- `/api/weekly-digest` — недельные дайджесты (только если **воскресенье UTC**, иначе пропуск; см. код)

Ограничение **Vercel Hobby**: один cron в сутки (`vercel.json`: `0 2 * * *` → `POST/GET /api/cron`). Частые отдельные cron job’ы для touchpoints **недоступны** на Hobby; обработка «отложенных» уведомлений происходит при срабатывании дневного cron (задержки до ~24 ч относительно идеального hourly).

## 4. Верификация и события

- **`/api/verify`** — сопоставление сигналов с событиями/архивом (логика в `src/lib/verification/`).
- События и матчи: таблицы по миграциям `003_verification`, `008_external_signals` и др.

## 5. Уведомления (клиент)

- Таблица **`notifications`**: клиент читает через Supabase с фильтром `status NOT IN (scheduled, cancelled)` (`NotificationBell`).
- **Realtime**: подписка на `INSERT` для обновления списка без перезагрузки.

## 6. Админ: снимки психики

- **`GET /api/admin/psyche-data`** — данные для **`/admin/psyche`** (роль architect/admin).
- Генерация снимков: **`POST /api/admin/generate-snapshots`** (только с cron-секретом или внутренними вызовами).

## Сводная таблица «процесс → артефакт»

| Процесс | Основные таблицы / артефакты |
|---------|------------------------------|
| Запись | `entries` |
| AI-анализ | `entries`, `deep_analysis` |
| Профиль психики | `symbolic_fingerprints` |
| Гео/глобальные снимки | `geo_snapshots`, `global_snapshots` |
| Удержание | `notifications` (engagement, digest, …) |
| Реальность | `reality_snapshots` |
| Настройки | `system_settings` |

Подробнее по таблицам: [05-database-schema-notes.md](./05-database-schema-notes.md).
