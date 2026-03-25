# Database & Schema Alignment (Supabase)

Документ связывает SQL-схему Supabase (миграции в `supabase/migrations/*`) и то, как приложение читает/пишет данные в коде.

## Таблицы и ключевые поля (по миграциям)

### `public.users` (`001_initial_schema.sql`, расширения `003_verification.sql`)

Ниже только наиболее используемые поля:

- `id` UUID (FK на `auth.users(id)`)
- `username` TEXT UNIQUE
- `role` TEXT
- `rating` DOUBLE PRECISION (в 001)
- `verified_count`, `rating_score`, `role` (в 003; `role` с CHECK на роли)
- `total_entries`, `total_matches`
- `is_public`

### `public.entries` (`001_initial_schema.sql` + `002_ai_fields.sql` + `003_verification.sql`)

Критичные поля:

- `id` UUID
- `user_id` UUID (FK на users)
- `type` TEXT NOT NULL CHECK (в 001: только `('dream','premonition')`)
- `title`, `content`
- `intensity` INTEGER CHECK (NULL допускается, т.к. нет NOT NULL)
- AI поля:
  - `ai_images` TEXT[] (в 002)
  - `ai_emotions` TEXT[] (в 001 и/или 002)
  - `ai_scale` TEXT CHECK `('personal','local','global')` (в 002)
  - `ai_geography` TEXT
  - `ai_specificity` FLOAT
  - `ai_summary` TEXT
  - `ai_analyzed_at` TIMESTAMPTZ
- Верификация:
  - `is_verified` BOOLEAN (в 003)
  - `best_match_score` FLOAT (в 003)
- Пользовательские метаданные:
  - `direction` TEXT CHECK (`'personal'|'other'|'collective'`)
  - `timeframe` TEXT CHECK (`'now'|'soon'|'distant'`)
  - `quality` TEXT CHECK (`'warning'|'neutral'|'revelation'`)

### `public.matches` (`001_initial_schema.sql` + `003_verification.sql`)

Ключевые поля:

- `entry_id` UUID FK entries
- `user_id` UUID FK users
- `event_title`, `event_description`, `event_source`, `event_url`
- `event_date` TIMESTAMPTZ
- `matched_symbols` TEXT[] (плейсхолдер для matched elements)
- `similarity_score` DOUBLE PRECISION CHECK 0..1
- `verification_status` TEXT default 'pending'
- `event_id` TEXT (в 003)
- Unique: `(entry_id, event_id)` (в 003)

### `public.clusters` (`001_initial_schema.sql` + `004_clusters.sql`)

Ключевые поля:

- `id` UUID
- Базовые:
  - `title`, `description`
  - `symbols` TEXT[]
  - `entry_ids` UUID[]
  - `anomaly_score` DOUBLE PRECISION CHECK 0..1
  - `baseline_frequency`, `current_frequency`
  - `geo_center`, `is_active`
- Расширенные (004):
  - `dominant_images` TEXT[]
  - `entry_count`, `unique_users`
  - `intensity_score`, `baseline_count`, `anomaly_factor`
  - `geography_data` JSONB
  - `ai_prediction`, `prediction_confidence`
  - `signal_type`, `time_horizon`
  - `is_resolved`, `started_at`, `resolved_at`

## Сопоставление с кодом: чтение/запись

## 1) Создание entry: `POST /api/entries`

Код: `src/app/api/entries/route.ts`

INSERT в `entries`:

- передаются: `user_id`, `title`, `content`, `is_public`, `is_anonymous`
- НЕ передаются: `type`

Но в схеме `entries.type`:

- `TEXT NOT NULL CHECK (type IN ('dream','premonition'))`

Следствие:

- Если миграции применены как описано, INSERT без `type` должен завершиться ошибкой.
- При текущем UI (`InlineEntryForm` отправляет только `{ content }`) запись скорее всего не создается.

## 2) ИИ анализ записи: `POST /api/analyze`

Код: `src/app/api/analyze/route.ts`

Обновление записи:

- `type: analysis.type`
- `ai_images: analysis.images`
- `ai_emotions: analysis.emotions`
- `ai_scale: analysis.scale`
- `ai_geography: analysis.geography`
- `ai_specificity: analysis.specificity`
- `ai_summary: analysis.summary`
- `ai_analyzed_at: now`

Проблема совместимости типов:

- `src/lib/claude/prompts.ts` (ANALYZE_ENTRY_PROMPT) разрешает `type`:
  - `"type": "" // "dream" | "premonition" | "feeling" | "vision"`
- Но схема `entries.type` ограничивает:
  - только `dream` и `premonition`

Следствие:

- Claude может вернуть `type=feeling/vision`, что нарушит CHECK constraint и приведёт к ошибке UPDATE.

Также несоответствия логики:

- В Claude-парсере есть поле `timeframe_signal`, но в UPDATE оно **не сохраняется** в БД.

## 3) Верификация: `POST /api/verify`

Код: `src/lib/verification/index.ts` (runVerification)

Выборка entries:

- `.from('entries').select('*, profiles:user_id (id)')`

Проблема:

- В схеме нет таблицы `profiles`.
- Правильное отношение в схеме — `users` (entries.user_id -> users.id).

Следствие:

- запрос может завершиться ошибкой (query build error) либо возвращать не то, что ожидается.
- Далее код всё равно использует `entry.user_id` как основной идентификатор пользователя, но без корректной выборки может не дойти до upsert в `matches`.

Upsert matches:

- `runVerification` upsert передаёт поля:
  - `event_id`, `event_source`, `event_title`, `event_url`, `event_date`
  - `similarity_score: match.match_score`
  - `matched_symbols: match.matched_elements`
  - `explanation`, `confidence`

Проверка constraint “event_date > created_at”:

- Реализована в `scoreMatch()`:
  - если `event.publishedAt < entry.created_at` -> null

## 4) Кластеры: `POST /api/cluster` и UI ноосферы

Код: `src/lib/clustering/index.ts` и `src/app/(main)/noosphere/*`

UI ноосферы использует:

- `clusters.geography_data` для сборки карты (`mapData`)

Но кластеризация:

- `runClustering.saveCluster()` не записывает `geography_data` (JSONB)
- зато записывает `geo_center` и `ai_prediction`

Следствие:

- `NoosphereMap` и “География Ноосферы” скорее всего останутся пустыми, пока `geography_data` не будет заполнено каким-либо другим процессом.

## 5) Реалтайм лента: `FeedClient`

Код: `src/app/(main)/feed/FeedClient.tsx`

Realtime subscription на INSERT:

- слушает таблицу `entries` и фильтрует `is_public=eq.true`
- на событие докачивает автора из `users` по `newEntry.user_id`

Схема:

- entries.user_id -> users.id (есть в 001)

Риск:

- payload typing не строгий; если event не содержит ожидаемых полей (например, изменения схемы), join может отвалиться, но это скорее runtime-сценарий.

## Что из этого критично для работоспособности

С точки зрения строгой совместимости SQL constraints и текущего кода, критичные места:

- `entries.type` (NOT NULL и CHECK в 001) vs `POST /api/entries` (type не передаётся)
- `ANALYZE_ENTRY_PROMPT` допускает `type` кроме dream/premonition vs schema CHECK
- `runVerification` использует `profiles` отношение, которого нет в схеме
- `NoospherePage` ожидает `clusters.geography_data`, а кластеризация не заполняет поле

## Актуальная схема vs код (v2)

Ниже — приоритетное соответствие “текущий код ↔ актуальные миграции”. Предыдущие пункты выше устарели (в текущей версии появилась `type: 'unknown'`, self-report, reactions/comments, `map-data`, и кластеризация теперь заполняет `clusters.geography_data`).

### Добавленные миграциями таблицы/поля (которые сейчас используются)

- `005_user_learning.sql`
  - `users.dominant_images`, `users.avg_specificity`, `users.avg_lag_days`
  - используется в `src/lib/learning/index.ts` (`updateUserProfile`)
- `006_archive.sql`
  - `historical_cases`
  - используется в `src/app/[locale]/(main)/archive/*` и `src/app/api/seed/route.ts`
- `007_self_report.sql`
  - `self_reports`
  - расширение `notifications` (добавлены `entry_id`, `action_type`, `scheduled_for`)
  - используется в `src/app/api/self-report/route.ts` и `src/components/layout/NotificationBell.tsx`
- `008_external_signals.sql`
  - `external_signals`
  - используется в `src/app/api/external-sync/route.ts` и `src/components/ExternalSignals.tsx`
- `009_comments_reactions.sql`
  - `comments`, `reactions`
  - `entries.image_url`
  - используется в `src/app/api/comments/route.ts`, `src/app/api/reactions/route.ts` и UI `EntryComments/EntryReactions/ImageUpload`

### Ключевые расхождения, которые стоит проверить (критично)

#### 1) `entries.type` CHECK ограничен migration 001

- В `supabase/migrations/001_initial_schema.sql`:
  - `entries.type TEXT NOT NULL CHECK (type IN ('dream', 'premonition'))`
- В текущем коде:
  - `src/app/api/entries/route.ts` вставляет `type: 'unknown'`
  - `src/lib/claude/parser.ts` допускает `type` из `['dream','premonition','unknown']` через `sanitizeEntryType`

**Следствие:** если CHECK constraint действительно применён как в 001 миграции, INSERT/UPDATE с `unknown` упадёт.

#### 2) Колонки `entries.ip_country_code`, `entries.ip_geography`, `entries.is_quarantine`

- Используются в текущем коде:
  - `src/app/api/entries/route.ts` вставляет:
    - `is_quarantine`
    - `ip_geography`, `ip_country_code`
  - `src/lib/clustering/index.ts` читает:
    - `ip_geography`, исключая `is_quarantine=true`
  - `src/app/api/map-data/route.ts` читает:
    - `ip_country_code`, `ip_geography`

- Но в миграциях 001–009:
  - нет `ip_country_code`, `ip_geography`, `is_quarantine` (поиск по миграциям не находит `ip_`/`is_quarantine`).

**Следствие:** при “чистом” применении миграций проект упадёт на runtime при обращениях к этим полям.

### Что сейчас точно согласовано

- `clusters.geography_data JSONB` есть в `004_clusters.sql`, и кластеризация его заполняет (`src/lib/clustering/index.ts`).
- `comments/reactions` есть в `009_comments_reactions.sql`, и эндпоинты совпадают с RLS-политиками.
- `self_reports` и расширенные `notifications` есть в `007_self_report.sql`, и UI self-report логически подключён.


