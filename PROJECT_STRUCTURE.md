# CASSANDRA — полная структура проекта

Ниже описана структура репозитория `CASSANDRA` (Next.js проект) с назначением основных файлов, модулей и интеграций. Документ предназначен для последующего анализа другими AI.

## Технологии и верхнеуровневые зависимости

- Web: `next` (App Router), `react` / `react-dom`, `typescript`
- Стили: `tailwindcss` + `postcss` + `globals.css`
- UI: компоненты на React/Next, `@vercel/og` (Open Graph изображения на Edge)
- Auth и БД: `@supabase/ssr`, `@supabase/supabase-js`, Supabase Auth + RLS
- ИИ:
  - `@anthropic-ai/sdk` (Claude) для извлечения параметров из записи и для верификации совпадений/кластеров
- Внешние источники событий:
  - `newsapi` (NewsAPI) и `usgs` (USGS Earthquake API)
  - `gdelt` объявлен как источник, но не реализован
- Деплой/таски: `vercel.json` + `cron` эндпоинты

## Корень репозитория

- `README.md` — базовый README шаблона create-next-app + комментарий `# cassandra`
- `package.json` — скрипты `dev/build/start/lint`, зависимости фронта и TypeScript
- `package-lock.json` — lockfile
- `tsconfig.json` — TS строгий (`strict: true`), пути `@/* -> ./src/*`
- `next.config.mjs` — пустая конфигурация кроме type-annotation
- `postcss.config.mjs` — плагин `tailwindcss`
- `tailwind.config.ts` — токены тем, content-сканирование, расширение `colors`/`fontFamily`/`borderRadius`
- `vercel.json` — cron задачи на `/api/analyze`, `/api/verify`, `/api/cluster`
- `.env.example` / `.env.local` — шаблон переменных окружения (Supabase, Anthropic, NewsAPI, Upstash, Sentry, PostHog и пр.)
- `.eslintrc.json` — расширения `next/core-web-vitals` и `next/typescript`
- `.gitignore` — стандартный игнор

## Supabase (схема и миграции)

- `supabase/migrations/001_initial_schema.sql`
  - Таблицы: `public.users`, `public.entries`, `public.entry_edits`, `public.matches`, `public.clusters`, `public.notifications`
  - Триггеры `updated_at`
  - Защита `entries.created_at`
  - Триггер автосоздания пользователя в `public.users` после `auth.users`
  - Триггер логирования изменений в `entry_edits`
  - RLS политики для таблиц
- `supabase/migrations/002_ai_fields.sql`
  - Дополняет `entries` AI-полями: `ai_images`, `ai_emotions`, `ai_scale`, `ai_geography`, `ai_specificity`, `ai_summary`, сброс `ai_analyzed_at` на `NULL`
  - Добавляет пользовательские метаданные: `direction`, `timeframe`, `quality`
- `supabase/migrations/003_verification.sql`
  - Дополняет `matches` полем `event_id` + ограничение уникальности `(entry_id, event_id)`
  - Дополняет `entries` полями `is_verified`, `best_match_score`
  - Дополняет `users` полями `verified_count`, `rating_score`, `role`
- `supabase/migrations/004_clusters.sql`
  - Расширяет `clusters` продвинутыми полями: `dominant_images`, `entry_count`, `unique_users`, `intensity_score`, `baseline_count`, `anomaly_factor`, `geography_data`, `ai_prediction`, `prediction_confidence`, `signal_type`, `time_horizon`, `is_resolved`, `started_at`, `resolved_at`

## Папка `src/`

### `src/middleware.ts`

- Точка входа Next.js middleware
- Вызывает `updateSession()` из `src/lib/supabase/middleware.ts` для обновления Supabase сессии и выполнения редиректов (защита `/login`, `/register`, приватных роутов и т.п.)

### `src/app/` (App Router)

#### Общий layout и корневая страница

- `src/app/layout.tsx`
  - RootLayout: подключает `globals.css`, Google font `Inter` через `next/font/google`, оборачивает в `AuthProvider` из `src/hooks/useUser.tsx`
  - Метаданные `metadata` уровня приложения
- `src/app/page.tsx`
  - Лендинг (публичная главная страница `/`)
  - Статическая верстка с CTA на `/login` и `/register`

#### Группа маршрутов `(auth)`

- `src/app/(auth)/layout.tsx`
  - Layout для auth-страниц: центрирование формы, фон `bg-cosmos`
- `src/app/(auth)/login/page.tsx`
  - `/login`: страница с `LoginForm` (Google OAuth + email/password)
  - Редирект на `next` (query param), дефолт `/feed`
- `src/app/(auth)/register/page.tsx`
  - `/register`: страница с `RegisterForm` (username/email/password + Google OAuth)
  - Валидация username (regex) и длины пароля

#### Группа маршрутов `(main)`

- `src/app/(main)/layout.tsx`
  - Layout для основной части: `Header` сверху и контейнер главного контента
- `src/app/(main)/feed/page.tsx`
  - Серверная страница `/feed`
  - Грузит 20 публичных `entries` с джойном `users` (`users:user_id (username, avatar_url)`)
  - Передает в клиент `FeedClient`
  - `export const dynamic = 'force-dynamic'` (лента всегда “fresh” при запросе)
- `src/app/(main)/feed/FeedClient.tsx`
  - Клиентский компонент:
    - Рендер списка `EntryCard`
    - Фильтры `all | dream | premonition`
    - “Погрузить еще” (pagination через `.range(from,to)`)
    - Supabase Realtime subscription на `public.entries` по `INSERT`, фильтр `is_public=eq.true`
    - При получении вставки докачивает автора из `users`
    - Локальная фильтрация state на лету для realtime-вставок
- `src/app/(main)/entry/[id]/page.tsx`
  - Серверная страница детали записи `/entry/:id`
  - Загружает запись + автора через Supabase серверный клиент (`createServerSupabaseClient()`)
  - Генерирует `generateMetadata()` для OG/Twitter через `/api/og`
- `src/app/(main)/entry/[id]/EntryClient.tsx`
  - Клиентская часть карточки детали:
    - Отображение типа, интенсивности, контента
    - Кнопка “Поделиться сигналом” (copy URL)
- `src/app/(main)/profile/[username]/page.tsx`
  - Заглушка публичного профиля (пока нет полноценной реализации)
- `src/app/(main)/noosphere/page.tsx`
  - Страница `/noosphere` (серверная)
  - Запрашивает `clusters` (активные), считает “индекс тревоги” и собирает:
    - map-данные по `clusters.geography_data`
    - топ образов по `entries.ai_images` за 48 часов vs baseline 30 дней
    - историю совпадений из `matches` с джойном `entries`
- `src/app/(main)/noosphere/NoosphereMap.tsx`
  - Клиентский map:
    - `react-simple-maps` + `d3-scale` для цветовой шкалы интенсивности
    - Загружает geo-данные по URL `world-atlas`
    - Эвристика маппинга стран (сравнение `countryName` по имени)

#### `src/app/api/` (Next API Routes в App Router)

- `src/app/api/entries/route.ts`
  - `POST /api/entries`
  - Валидация текста (`content.length >= 30`)
  - Требует авторизацию (Supabase `auth.getUser()` через createServerClient)
  - Вставляет запись в `public.entries`
  - Увеличивает `users.total_entries` (select + update)
  - Возвращает `{ data: entry }` с `id`/`created_at`
- `src/app/api/analyze/route.ts`
  - `POST /api/analyze` (фоновый обработчик по cron)
  - Service-role Supabase клиент
  - Выбирает `entries` с `ai_analyzed_at IS NULL`, ограничение `10`
  - Для каждой записи вызывает `analyzeEntry()` (Claude)
  - Записывает AI поля назад в `entries` и проставляет `ai_analyzed_at`
- `src/app/api/verify/route.ts`
  - `POST /api/verify` (cron)
  - Проверяет cron header `Authorization: Bearer ...` (опционально, зависит от `CRON_SECRET`)
  - Вызывает `runVerification()` из `src/lib/verification`
  - Возвращает результат в JSON
- `src/app/api/cluster/route.ts`
  - `POST /api/cluster` (cron)
  - Вызывает `runClustering()` из `src/lib/clustering`
  - Содержит проверку `Authorization` против `CRON_SECRET`/`SUPABASE_SERVICE_ROLE_KEY`
- `src/app/api/cron/route.ts`
  - Заглушка `GET /api/cron` (TODO / фаза 2)
- `src/app/api/news-test/route.ts`
  - `GET /api/news-test`
  - Вызов `fetchAllEvents(3)` и возврат статистики источников + sample
- `src/app/api/og/route.tsx`
  - `GET /api/og` (runtime: `edge`)
  - Генерация OG изображения через `@vercel/og` на основе query params (`type`, `title`, `username`, `intensity`, `date`)
- `src/app/api/auth/callback/route.ts`
  - `GET /api/auth/callback`
  - Exchange OAuth `code` на Supabase session через `exchangeCodeForSession`
  - Редирект на `next` или на `/login?error=...`

### `src/components/` (UI компоненты)

- `src/components/AuthGuard.tsx`
  - Клиентский guard по `useUser()` (редиректы в зависимости от `requireAuth`)
  - В текущем коде почти не используется (редиректы делает middleware)
- `src/components/EntryCard.tsx`
  - Карточка записи в ленте
  - Рендер: автор, время (`date-fns/ru`), тип/бейдж, контент, “интенсивность” точками
- `src/components/InlineEntryForm.tsx`
  - Форма добавления записи в ленту:
    - `POST /api/entries`
    - После успешного сохранения запускает `POST /api/analyze` “в фоне”
- `src/components/layout/Header.tsx`
  - Верхняя навигация для основной части:
    - Ссылка на `/feed`
    - Ссылка на `/noosphere`
    - Аватар с редиректом на `/profile/:username`

### `src/hooks/`

- `src/hooks/useUser.tsx`
  - `AuthProvider` + контекст `useUser()`
  - Слушает `supabase.auth.onAuthStateChange`
  - Загружает профиль из `users` по `id`
  - Предусмотрен комментарий про Deadlock (исключение для await в listener)

### `src/lib/` (бизнес-логика и интеграции)

- `src/lib/claude/`
  - `client.ts` — вызов Claude для анализа entry (`analyzeEntry`)
  - `parser.ts` — парсинг JSON-ответа Claude (`parseClaudeResponse`)
  - `prompts.ts` — промпты и форматирование user message
- `src/lib/clustering/index.ts`
  - `runClustering()`:
    - статистика AI-образов за 48 часов
    - сравнение с baseline 30 дней
    - поиск аномалий по росту частоты
    - при необходимости вызов Claude для прогноза сигнала
    - сохранение в `clusters` через `upsert`
- `src/lib/scoring/index.ts`
  - рейтинг и роль пользователя на основе проверенных совпадений (`calculateRatingScore`, `getRoleForUser`)
- `src/lib/verification/`
  - `index.ts` — `runVerification()`:
    - перебор `entries` для верификации
    - вызов `scoreMatch()` по каждому news-event
    - upsert в `matches`
    - апдейт `entries.is_verified` и `best_match_score`
    - пересчет rating/role
  - `scorer.ts` — `scoreMatch()`:
    - Claude prompt для оценки совпадения entry vs событие
    - валидация JSON и возврат `match_score/matched_elements/...`
- `src/lib/news/`
  - `index.ts` — `fetchAllEvents(daysBack)`:
    - `Promise.all([fetchRecentNews, fetchEarthquakes])`
    - дедупликация по `title`
    - сортировка по `publishedAt`
  - `newsapi.ts` — fetch из NewsAPI
  - `usgs.ts` — fetch из USGS Earthquake API
  - `gdelt.ts` — не реализован (throw Error)
  - `types.ts` — интерфейс `NewsEvent`
- `src/lib/supabase/`
  - `client.ts` — браузерный supabase client (singleton в браузере)
  - `server.ts` — серверный client с cookies (anon key) + admin client (service key)
  - `middleware.ts` — helper для middleware: `updateSession()`

### `src/styles/`

В репозитории отдельной папки `src/styles/` нет; стили находятся в `src/app/globals.css` и Tailwind.

## Supabase client/Server distinction (важное)

- `src/lib/supabase/client.ts` используется в Client Components (`use client`) и создаёт browser singleton.
- `src/lib/supabase/server.ts` используется в Server Components/Route handlers (через cookies).
- Service-role операции в cron (`/api/analyze`, `src/lib/clustering`, `src/lib/verification`) используют service key либо `createClient` из `@supabase/supabase-js`.

