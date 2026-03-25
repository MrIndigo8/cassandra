# Goals & Design Decisions

Документ фиксирует “цели” (что проект пытается делать) и ключевые архитектурные решения, которые отражены в коде.

## Цель продукта (по текстам и промптам)

- Концепция “Кассандра — платформа коллективного предосознания”:
  - пользователи записывают “сны и предчувствия”
  - платформа анализирует записи ИИ (Claude)
  - далее ищет “совпадения” с реальными новостными/событийными источниками
  - дополнительно делает “ноосферу”: глобальная карта/индекс тревоги и история совпадений

## Решение: структурированный ИИ (строго валидный JSON)

- `src/lib/claude/prompts.ts`
  - промпты explicitly требуют “ТОЛЬКО валидный JSON”
  - разрабатывались отдельные промпты под:
    - анализ entry (`ANALYZE_ENTRY_PROMPT`)
    - верификацию match (`VERIFY_MATCH_PROMPT`)
    - кластерный сигнал (`CLUSTER_SIGNAL_PROMPT`)
- `src/lib/claude/parser.ts` и ручная “очистка” JSON:
  - парсер пытается извлечь JSON из ответа даже если Claude оборачивает в ```json ...```

## Решение: разделение на Server/Client Supabase клиенты

- `src/lib/supabase/client.ts`
  - `createClient()` создаёт браузерный singleton для Client Components
- `src/lib/supabase/server.ts`
  - `createServerSupabaseClient()` учитывает cookies и используется в Server Components/API routes
- `src/lib/supabase/middleware.ts`
  - обновление сессии на каждом запросе, редирект логики

## Решение: фоновые задачи через cron-эндпоинты

- `vercel.json` определяет cron на:
  - `/api/analyze` (ежедневно)
  - `/api/verify` (ежедневно)
  - `/api/cluster` (каждые 6 часов)
- Дополнительно анализ запускается сразу после сохранения entry из UI:
  - `src/components/InlineEntryForm.tsx`

## Решение: realtime лента

- `src/app/(main)/feed/FeedClient.tsx`
  - подписка на Postgres INSERT в `entries`
  - realtime payload расширяется джойном `users` (докачивание автора)

## Решение: рейтинг и роли на основе подтвержденных совпадений

- `src/lib/scoring/index.ts`
  - `calculateRatingScore` с реценси-весом (half-life ~1 год) и анти-спам пенальти
  - `getRoleForUser` превращает статы в роли `observer/chronicler/sensitive/oracle`
- `src/lib/verification/index.ts`
  - пересчитывает rating/role при обнаружении match

## Решение: защита записи `created_at`

- В миграции 001:
  - триггер `protect_entries_created_at` запрещает изменения `created_at` в `entries`

## Важное примечание из кода (deadlock)

- В `src/components/AuthGuard.tsx` логики нет
- В `src/hooks/useUser.tsx` есть комментарий:
  - при `onAuthStateChange` нельзя использовать `await fetchProfile(...)` (иначе возникает deadlock в библиотеке GoTrue)
  - используется `void fetchProfile(...)`

*** Примечание ***

Ниже в документах `DATABASE_AND_SCHEMA_ALIGNMENT.md` и `BUGS_RISKS_AND_GAPS.md` отмечены несовпадения между:
- ожиданиями промптов и CHECK constraints схемы,
- ожиданиями UI и тем, какие поля реально заполняются кластеризацией,
- join в verification и реальным именованием таблиц в миграциях.

## Актуальные дизайн-решения (v2)

### Антиспам и карантин

- В `src/app/api/entries/route.ts` перед сохранением entry выполняется:
  - `checkSpam(user.id, content)` из `src/lib/antispam/index.ts`
- `checkSpam`:
  - частотный лимит (>= 5 записей за 24 часа)
  - минимальная длина (>= 30 символов)
  - “карантин” для новых аккаунтов (< 30 дней с регистрации)
  - (опционально при наличии ключей) Claude-детектор спама через `SPAM_DETECTION_PROMPT`
- Результат сохраняется в `entries.is_quarantine` и используется в кластеризации.

### Санитизация type (чтобы удерживать данные в допустимом наборе)

- В `src/lib/claude/parser.ts`:
  - `sanitizeEntryType` разрешает `['dream','premonition','unknown']`
- Это снижает риск “вылета” из SQL constraints и упрощает отрисовку в UI.

### Self-learning профиля

- После успешных совпадений в `runVerification`:
  - создаётся notification пользователю (`createMatchNotification`)
  - пересчитываются rating/role
  - вызывается learning `updateUserProfile(userId)`
- Learning обновляет:
  - `users.dominant_images`
  - `users.avg_specificity`
  - `users.avg_lag_days`

### Уведомления как часть воронки

- События уведомлений лежат в `notifications` и используются в UI через `NotificationBell`.
- Отдельно есть self-report workflow:
  - `src/app/api/self-report/route.ts` сохраняет `self_reports` и обновляет entry/users/notifications.

### Карта Ноосферы через серверный агрегатор

- UI карты не строит “все данные” сам.
- Используется единый endpoint `GET /api/map-data`, который возвращает:
  - `activityMap` (entries по IP-географии)
  - `anxietyMap` (clusters по `geography_data`)
  - `worldEvents` (из `fetchAllEvents`)

### Расширение UX через реакции/комментарии и внешние сигналы

- Reactions/Comments: `api/reactions`, `api/comments`
- External signals:
  - `api/external-sync` (cron-like POST с сервисным ключом)
  - `components/ExternalSignals` — табы Reddit/Polymarket
- Archive:
  - `historical_cases` + `api/seed`

