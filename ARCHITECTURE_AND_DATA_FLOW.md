# Architecture & Data Flow

Документ описывает архитектуру приложения `CASSANDRA` (Next.js App Router + Supabase + Claude) и основные “потоки” (auth, лента, анализ/верификация/кластеризация).

## 1) Архитектура Next.js (App Router)

### Layout hierarchy

- `src/app/layout.tsx` (RootLayout)
  - Подключает `src/app/globals.css`
  - Оборачивает всё приложение в `AuthProvider` из `src/hooks/useUser.tsx`
- `src/app/(auth)/layout.tsx`
  - Общий layout для `/login` и `/register` (централизованная форма)
- `src/app/(main)/layout.tsx`
  - Общий layout для главной части:
    - отображает `Header` из `src/components/layout/Header.tsx`

### Страницы и маршруты

- Публичные:
  - `/` — `src/app/page.tsx` (лендинг)
  - `/login` — `src/app/(auth)/login/page.tsx`
  - `/register` — `src/app/(auth)/register/page.tsx`
- Приватная/основная часть:
  - `/feed` — `src/app/(main)/feed/page.tsx` + `FeedClient.tsx`
  - `/entry/[id]` — `src/app/(main)/entry/[id]/page.tsx` + `EntryClient.tsx`
  - `/profile/[username]` — `src/app/(main)/profile/[username]/page.tsx` (пока заглушка)
  - `/noosphere` — `src/app/(main)/noosphere/page.tsx` + `NoosphereMap.tsx`

## 2) Middleware и защита роутов

- `src/middleware.ts`
  - Любой запрос проходит через `updateSession(request)` (в `src/lib/supabase/middleware.ts`)
- `src/lib/supabase/middleware.ts`:
  - Создаёт серверный Supabase client (`createServerClient`) с cookie-based подходом
  - Делает `supabase.auth.getUser()` для определения текущей сессии
  - Логика редиректов:
    - если нет пользователя и роут не публичный (`/`, `/login`, `/register`), не API и не `_next/*` -> редирект на `/login`
    - если пользователь уже залогинен и пытается открыть `/login` или `/register` -> редирект на `/feed`

## 3) Auth слой (Supabase)

### OAuth callback

- `src/app/api/auth/callback/route.ts`
  - Обрабатывает `code` параметр
  - Делает `supabase.auth.exchangeCodeForSession(code)`
  - Редиректит на `next` или на `/login?error=...`

### Клиентский провайдер пользователя

- `src/hooks/useUser.tsx`
  - `AuthProvider`:
    - держит `user` (Supabase auth user) и `profile` (строка `public.users`)
    - слушает `supabase.auth.onAuthStateChange`
    - при наличии `session.user.id` вызывает `fetchProfile(user.id)`
  - `fetchProfile` делает запрос в `users`:
    - `.from('users').select('*').eq('id', userId).single()`

### UI-компоненты, которые используют профиль

- `src/components/layout/Header.tsx`
  - показывает аватар и линк на `/profile/:username`
- `src/components/InlineEntryForm.tsx`
  - показывает аватар автора внутри формы

## 4) Публикация сигнала (entry)

### Клиент -> API

- `src/components/InlineEntryForm.tsx`
  - `POST /api/entries` с телом `{ content }`
  - ожидает JSON-ответ
  - после успешного сохранения запускает `fetch('/api/analyze', { method: 'POST' })` в фоне (fire-and-forget)

### API entry storage

- `src/app/api/entries/route.ts`
  - Создаёт серверный Supabase client с cookies
  - Проверяет `auth.getUser()`
  - Валидация: `content.length >= 30`
  - INSERT в `public.entries`:
    - `user_id`, `title`, `content`, `is_public`, `is_anonymous`
  - Увеличивает `users.total_entries`:
    - select `total_entries` и последующий update `total_entries + 1`

## 5) ИИ анализ записи (cron-driven)

### Триггер/расписание

- `vercel.json`
  - cron: `/api/analyze` ежедневно в `0 0 * * *`
  - также `/api/analyze` вызывается сразу после публикации entry (в `InlineEntryForm`), но как фон

### Анализ

- `src/app/api/analyze/route.ts`
  - Service-role Supabase client (`@supabase/supabase-js`)
  - Выбирает `entries` где `ai_analyzed_at IS NULL`, limit `10`
  - Для каждой entry:
    - вызывает `analyzeEntry(content, type, direction, timeframe, quality)`
    - обновляет поля:
      - `type`
      - `ai_images`
      - `ai_emotions`
      - `ai_scale`
      - `ai_geography`
      - `ai_specificity`
      - `ai_summary`
      - `ai_analyzed_at`

### Claude извлечение

- `src/lib/claude/client.ts`
  - использует `model: 'claude-sonnet-4-6'`
  - `system: ANALYZE_ENTRY_PROMPT`
  - ответы ожидаются в формате валидного JSON
- `src/lib/claude/parser.ts`
  - чистит возможные оболочки ` ```json ... ``` `
  - пытается извлечь JSON между первой `{` и последней `}`

## 6) Верификация совпадений (cron-driven)

### Триггер

- `vercel.json`:
  - cron: `/api/verify` ежедневно в `0 1 * * *`

### API / вычисления

- `src/app/api/verify/route.ts`
  - вызывает `runVerification()` из `src/lib/verification`

### runVerification()

- `src/lib/verification/index.ts`
  - берёт непроверенные записи (`entries.is_verified = false`)
  - условие: `ai_analyzed_at NOT NULL`
  - ограничение batch: `limit(50)`
  - берёт свежие “новостные события”: `fetchAllEvents(3)`
  - для каждой записи перебирает события:
    - оценивает совпадение `scoreMatch(entryData, event)`
    - если `match_score > 0.6`:
      - upsert в `matches`
      - увеличивает счётчик matchedCount
  - после цикла:
    - всегда ставит `entries.is_verified = true` и обновляет `best_match_score` (даже если сильного совпадения не найдено)
  - если найден match:
    - пересчитывает рейтинг/роль пользователя (`calculateRatingScore`, `getRoleForUser`)

### scoreMatch()

- `src/lib/verification/scorer.ts`
  - Claude prompt `VERIFY_MATCH_PROMPT`
  - запроса выполняется с `temperature: 0` и “ожиданием JSON”
  - извлекает `{...}` из ответа и парсит JSON
  - возвращает `match_score`, `matched_elements`, `explanation`, `confidence`

## 7) Кластеризация/анализ паттернов (cron-driven)

### Триггер

- `vercel.json`:
  - cron: `/api/cluster` каждые `6 часов` (`0 */6 * * *`)

### API и выполнение

- `src/app/api/cluster/route.ts`
  - вызывает `runClustering()`

### runClustering()

- `src/lib/clustering/index.ts`
  - берёт entries за последние 48 часов с заполненными `ai_images`
  - считает частоту каждого образа и число уникальных пользователей
  - строит significantImages:
    - образ должен встречаться минимум у 2 разных пользователей
  - строит baseline_counts:
    - для тех же образов по 30-дневному периоду
  - для каждого significant image:
    - baseline48h = baselineCounts[image] / 15 (15 окон по 48 часов)
    - anomalyFactor = currentCount / baseline48h
    - если `currentData.count > 2` и `anomalyFactor > 2.0`:
      - intensityScore = anomalyFactor * log(uniqueUsers+1)
      - при intensityScore > 2 и наличии anthropic ключа:
        - вызывает Claude через `analyzeClusterWithAI(...)`
      - сохраняет кластер в `clusters` via `.upsert(... onConflict:'id')`

## 8) UI: лента, realtime и ноосфера

### Feed

- Сервер:
  - `src/app/(main)/feed/page.tsx` грузит 20 публичных записей с join `users`
  - `dynamic='force-dynamic'`
- Клиент:
  - `src/app/(main)/feed/FeedClient.tsx`
    - рендерит список
    - realtime subscription INSERT в `entries` для публичных (`is_public=true`)
    - при вставке докачивает автора из `users`

### Ноосфера

- `src/app/(main)/noosphere/page.tsx`:
  - clusters: активные (`is_resolved = false`) и отсортированы по `intensity_score desc`
  - anxiety index: среднее `intensity_score` по активным clusters
  - top images: сравнение частоты `entries.ai_images` в 48 часов vs 30 дней (baseline)
  - history matches: `matches` limit 10, join `entries (created_at, ai_images)`
- `src/app/(main)/noosphere/NoosphereMap.tsx`:
  - цветовая шкала от 0 до 10 на основе `cluster.intensity_score`
  - маппинг стран делается эвристикой по названию страны

