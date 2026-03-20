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

