# Bugs, Risks & Gaps

Документ перечисляет баги/риски/пробелы, выявленные при анализе кода и схемы Supabase.

Формат: “серьезность -> что -> где -> почему это проблема -> что проверить/исправить”.

## Критичные (likely breaks production)

1. `POST /api/entries` не задаёт `entries.type`, хотя в схеме `entries.type`:
   - `TEXT NOT NULL CHECK (type IN ('dream','premonition'))`
   - Где: `src/app/api/entries/route.ts`
   - Почему: запись в `public.entries` должна падать при INSERT без `type`.
   - Что проверить: реально ли таблица создана из миграции 001 без изменений; воспроизвести запрос `/api/entries` в dev и посмотреть ответ/лог.

2. Верификация: запрос entries использует `profiles:user_id (id)`, но такой таблицы нет в миграциях.
   - Где: `src/lib/verification/index.ts`
   - Почему: join строится от `profiles`, а схема объявляет таблицу `public.users`.
   - Что проверить: выполнение `runVerification()` логами/ошибками; заменить join на `users:user_id (id)` (или полностью убрать join если не используется).

## Серьезные (вероятны runtime errors/данные не соответствуют UI)

3. Claude анализ записи может вернуть `type=feeling|vision`, но схема entries ограничивает `dream|premonition`.
   - Где: `src/lib/claude/prompts.ts` (ANALYZE_ENTRY_PROMPT) + `src/app/api/analyze/route.ts`
   - Почему: UPDATE в `entries.type` нарушит CHECK constraint.
   - Что проверить: примеры ответов Claude; либо сузить prompt до dream/premonition, либо добавить mapping (например, map feeling/vision -> premonition/dream по эвристике).

4. Кластеры и карта ноосферы: UI рассчитывает данные из `clusters.geography_data`, но `runClustering` поле не заполняет.
   - Где: `src/app/(main)/noosphere/page.tsx` и `src/lib/clustering/index.ts`
   - Почему: geography_data в миграции 004 есть, но запись кластеров не пишет его; карта останется “серой/пустой”.
   - Что проверить: содержимое `clusters` после `/api/cluster`.

5. Несостыковка полей между типами/кодом и тем, что реально хранится.
   - Где:
     - `src/lib/claude/parser.ts` (есть `timeframe_signal`)
     - `src/app/api/analyze/route.ts` (не сохраняет timeframe_signal в БД)
   - Почему: данные могут теряться, а UI/аналитика ожидать их не будет.
   - Что проверить: schema columns vs обновления в analyze.

## Средние (качество, безопасность, неполные фичи)

6. `src/app/api/cron/route.ts` не реализован (GET возвращает 501).
   - Где: `src/app/api/cron/route.ts`
   - Почему: сейчас cron используется через `vercel.json` на конкретные endpoints (`/api/analyze`, `/api/verify`, `/api/cluster`), но “единый cron” остаётся мёртвым.
   - Что проверить: не планируется ли переключение на `/api/cron`.

7. Tailwind design tokens не определены.
   - Где: `src/app/page.tsx`, `src/app/(auth)/*`, `src/app/globals.css`, `tailwind.config.ts`
   - Конкретные примеры неопределённых классов:
     - `bg-void-border`, `bg-cosmos`, `bg-aurora`
     - `text-mist*`
     - `bg-dream/10`, `border-dream/20`, `bg-match/10`, `shadow-glow-sm`
     - `animate-pulse-slow`, `animate-ping-slow`
   - Почему: эти классы вероятно не будут применяться визуально (Tailwind не сгенерирует утилиты).
   - Что проверить: фактический CSS build output/visual regressions.

8. Fonts: в проекте есть `src/app/fonts/*.woff`, но нет `@font-face` / подключения.
   - Где: `src/app/layout.tsx` и отсутствие подключения в CSS
   - Почему: ожидаемая типографика может не применяться.

9. Логи в продакшн и отладочные `console.log`.
   - Где: `src/hooks/useUser.tsx` (много `console.log`), `src/lib/*` (много `console.log`)
   - Почему: шум, удорожание logs, риск утечек в зависимости от окружения.

## Низкие / архитектурные риски

10. Security проверки cron endpoints:
   - Где: `src/app/api/verify/route.ts`, `src/app/api/cluster/route.ts`
   - Проблема: проверка для `cluster` сравнивает `authorization` не только с `CRON_SECRET`, но и допускает совпадение с `SUPABASE_SERVICE_ROLE_KEY`.
   - Почему: service role key — секрет уровня БД; использование его как “cron token” увеличивает риск случайной компрометации.

11. Supabase realtime payload typing и join.
   - Где: `src/app/(main)/feed/FeedClient.tsx`
   - Почему: если schema реального payload поменяется, код может падать/рендерить не то.

## Границы/пробелы функциональности (product gaps)

12. Публичный профиль — заглушка.
   - Где: `src/app/(main)/profile/[username]/page.tsx`

13. `src/lib/news/gdelt.ts` — не реализован.
   - Где: `src/lib/news/gdelt.ts`
   - Почему: `NewsEvent.source` включает `gdelt`, но `fetchAllEvents` его не использует.

14. Секция “фоновые задачи” в UI/логике может быть неочевидной:
   - `InlineEntryForm` вызывает `/api/analyze` после POST entries, а также есть cron на `/api/analyze`.
   - Возможный дубль вызовов и гонки: два анализатора могут обработать одну и ту же запись, если `ai_analyzed_at` проставляется не атомарно.
   - Где: `src/components/InlineEntryForm.tsx` и `src/app/api/analyze/route.ts`

## Актуальные критичные риски (v2)

1. **Несоответствие `entries.type='unknown'` vs миграция 001**
   - Где: `src/app/api/entries/route.ts` (INSERT `type: 'unknown'`)
   - Где: `supabase/migrations/001_initial_schema.sql` (CHECK только `dream/premonition`)
   - Почему: при фактическом применении миграций возможна ошибка CHECK constraint.
   - Что проверить: актуальные constraints в Supabase (посмотреть реальную структуру таблицы `entries`).

2. **Колонки `entries.ip_country_code`, `entries.ip_geography`, `entries.is_quarantine`**
   - Где: `src/app/api/entries/route.ts`, `src/lib/clustering/index.ts`, `src/app/api/map-data/route.ts`
   - Почему: эти поля нужны для антиспама/карантина, построения `activityMap` и `anxietyMap`.
   - Что проверить: есть ли эти колонки в БД сейчас. Если нет — добавить миграции или откатить код к отсутствующим полям.

3. **Динамический серверный фетч во время `next build` (Next caching restrictions)**
   - Наблюдение из лога build:
     - `Dynamic server usage: no-store fetch https://api.rss2json.com/... /api/reddit-test`
     - по нескольким сабреддитам, итог — получено 0 постов
   - Почему: часть страниц/роутов вызывает `/api/reddit-test` на этапе генерации страниц, а `no-store fetch` конфликтует с режимом статической оптимизации.
   - Что проверить: какие именно страницы инициируют `/api/reddit-test` во время build; пометить их `dynamic='force-dynamic'` или перенести fetch на runtime по запросу.

## Актуальные средние риски

4. **Гонки анализа записи**
   - Где: `InlineEntryForm` fire-and-forget POST `/api/analyze` + cron на `/api/analyze`
   - Почему: `runAnalysis` берёт entries, где `ai_analyzed_at IS NULL`. При параллельных вызовах возможно двойное обновление/лишняя стоимость токенов.
   - Что улучшить: “mark before analyze” (атомарно проставлять `ai_analyzed_at` в момент взятия в работу) или вводить флаг `analysis_in_progress`.

5. **Недостаточная валидация JSON тела в некоторых эндпоинтах**
   - Например: `/api/reactions` принимает `entry_id, emoji` без серверной проверки формата (RLS и CHECK частично спасают).
   - Что улучшить: zod/valibot на входе, чтобы избегать лишних 500 и обеспечить корректные error messages.

6. **UI навигация без locale-prefixed путей**
   - Пример: `NotificationBell` пушит `router.push(`/entry/${entryId}`)` без учета locale-префикса.
   - Что проверить: корректность роутинга на `/en/...` и `/ru/...`.


