# Ручная настройка CASSANDRA (Supabase, Vercel, секреты)

Этот файл — **что нужно сделать вручную** в браузере и консоли. Код в репозитории уже рассчитан на эти шаги.

---

## 1. Локально: переменные окружения

1. Скопируйте `.env.example` в `.env.local` (если ещё нет).
2. Откройте `.env.local` в редакторе.
3. Заполните минимум для разработки:
   - `NEXT_PUBLIC_SUPABASE_URL` — из Supabase → **Project Settings → API → Project URL**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **anon public** ключ
   - `SUPABASE_SERVICE_ROLE_KEY` — **service_role** (только сервер, не в клиент)
   - `ANTHROPIC_API_KEY` — ключ Anthropic Console
   - `CRON_SECRET` — сгенерируйте случайную строку (например `openssl rand -hex 32`) — для вызова `/api/cron`, `/api/analyze` и т.д. с заголовком `Authorization: Bearer <CRON_SECRET>`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000` для локального `npm run dev`

**Где вставить:** только в файл `.env.local` в корне проекта. В Git этот файл не коммитьте.

---

## 2. Supabase: миграции базы

**Вариант A — CLI (рекомендуется, если установлен Supabase CLI):**

1. Установите [Supabase CLI](https://supabase.com/docs/guides/cli).
2. В корне проекта выполните логин и линк проекта (по документации Supabase).
3. Выполните: `supabase db push` или примените миграции через `supabase migration up` — как принято в вашем workflow.

**Вариант B — SQL в Dashboard:**

1. Зайдите на [https://supabase.com](https://supabase.com) → ваш проект.
2. Слева: **SQL Editor** → **New query**.
3. Откройте в репозитории папку `supabase/migrations/` и **по порядку номеров** выполняйте содержимое файлов (001, 002, … 026), если миграции ещё не применялись.
4. Нажмите **Run** для каждого скрипта (или объедините осознанно, если знаете, что делаете).

**Проверка после миграций:**

- **Table Editor** → таблица `entries`: есть ли колонки `type` (с расширенным CHECK из поздних миграций), `ip_country_code`, `ip_geography`, `is_quarantine`, `user_insight`, `prediction_potential`, поля согласия и т.д.
- Таблица `users`: колонки `consent_accepted_at`, `consent_version` (миграция `026_user_consent.sql`).

**Где нажимать:** Supabase Dashboard → **SQL Editor** / **Table Editor**.

---

## 3. Supabase: Auth и URL приложения

1. **Authentication** → **URL Configuration**.
2. **Site URL:** продакшен URL (например `https://ваш-домен.vercel.app`).
3. **Redirect URLs:** добавьте:
   - `http://localhost:3000/**`
   - `https://ваш-домен.vercel.app/**`
4. Сохраните.

**Где:** Supabase → **Authentication** → **URL Configuration**.

---

## 4. Vercel: деплой и переменные

1. Импортируйте репозиторий в [Vercel](https://vercel.com).
2. **Settings** → **Environment Variables** — добавьте **те же** переменные, что в `.env.local`, для окружений **Production** (и при необходимости **Preview**):
   - Все `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `NEWSAPI_KEY` (если используете новости), и т.д.
3. Убедитесь, что `NEXT_PUBLIC_APP_URL` в Production указывает на **реальный** URL деплоя (например `https://xxx.vercel.app`).
4. **Deployments** → последний деплой → дождитесь **Ready**.

**Где:** Vercel Dashboard → проект → **Settings** → **Environment Variables**.

---

## 5. Vercel Cron

В `vercel.json` задан путь `/api/cron` по расписанию. Cron вызывает URL **без** вашего `Authorization` по умолчанию — поэтому в коде оркестратор должен быть доступен только если вы настроили доступ так, как задумано в вашей версии Vercel.

**Надёжный вариант:** вызывать тот же пайплайн **вручную** или через внешний cron с заголовком:

```http
POST /api/cron
Authorization: Bearer <CRON_SECRET>
```

**Где смотреть:** Vercel → проект → **Cron Jobs** (если включено для плана). Логи — **Deployments** → **Functions** / **Logs**.

Эндпоинт `GET /api/analyze` тоже требует `Authorization: Bearer <CRON_SECRET>` — отдельный Cron в Vercel без кастомных заголовков к нему **не подойдёт**, пока вы явно не передаёте секрет (см. комментарий в `src/lib/auth/verifyCron.ts`).

---

## 6. Согласие пользователей (миграция 026)

После применения SQL из `026_user_consent.sql`:

- В приложении логика регистрации/баннера должна записывать `consent_accepted_at` / `consent_version` через ваш API (уже предусмотрено в коде — при наличии флоу).
- **Проверка:** Supabase → **Table Editor** → `users` → у тестового пользователя после принятия условий должны заполниться поля.

**Где:** Table Editor или SQL: `SELECT id, consent_accepted_at, consent_version FROM users LIMIT 10;`

---

## 7. Новости и GDELT

- События для верификации подтягиваются из `fetchAllEvents` (NewsAPI, USGS, Guardian и т.д. по коду в `src/lib/news/`).
- Файл `src/lib/news/gdelt.ts` пока возвращает пустой массив (**фаза 3**). Полноценный GDELT требует отдельной интеграции и, при необходимости, ключей/URL в `.env`.

**Вручную:** получите `NEWSAPI_KEY` на [newsapi.org](https://newsapi.org) и добавьте в `.env.local` / Vercel.

---

## 8. Быстрая проверка после настройки

1. Локально: `npm run build` — без ошибок.
2. Открыть сайт → регистрация/логин → создать запись в ленте.
3. Убедиться, что в Supabase в `entries` появилась строка, у разработанных фич — заполнены AI-поля после анализа (или после cron).

---

## Краткий чеклист «куда нажать»

| Действие | Где |
|----------|-----|
| Вставить ключи | `.env.local` / Vercel **Environment Variables** |
| Применить SQL | Supabase **SQL Editor** или CLI `db push` |
| Redirect для OAuth | Supabase **Authentication → URL Configuration** |
| Смотреть таблицы | Supabase **Table Editor** |
| Логи деплоя | Vercel **Deployments → Logs** |
| Cron | Vercel **Cron Jobs** + проверка вызова `/api/cron` с `CRON_SECRET` |

Если нужно, следующий шаг — пошагово только **Supabase RLS** или только **кастомный домен Vercel**; напишите, что из этого актуально.
