# CASSANDRA — работоспособность и достижение целей

## Что я проверил прямо в проекте

- **`npm run lint`** — **успешно** (0 ошибок).
- **`npm run build`** — **успешно**.
  - Раньше build падал из‑за `dotenv`/`@ts-expect-error` в скриптах. Я это устранил:
    - добавил пакет `dotenv`
    - убрал “unused” `@ts-expect-error` из `src/scripts/seed-archive.ts`
  - В процессе сборки сохраняются **warnings** уровня “кэш/статическая оптимизация”, но build завершился успешно.

## Общий вывод: что можно считать “работает сейчас”

### Frontend / UX

- Присутствуют основные пользовательские сценарии:
  - **Landing** (до входа) — `src/app/[locale]/page.tsx`
  - **Auth** — login/register на Supabase + next-intl (`src/app/[locale]/(auth)/*`)
  - **Feed** + realtime — `src/app/[locale]/(main)/feed/*` (server: загрузка initial entries, client: realtime INSERT + пагинация/фильтр)
  - **Entry detail** — `src/app/[locale]/(main)/entry/[id]/EntryClient.tsx`
    - реакции (`EntryReactions`)
    - комментарии (`EntryComments`)
    - share/copy
  - **Noosphere** (карта/индекс/кластеры) — `src/app/[locale]/(main)/noosphere/*`
    - карта строится по данным `/api/map-data`
  - **Events / verification** — `src/app/[locale]/(main)/events/page.tsx` + `VerifyButton`
  - **Archive** — `src/app/[locale]/(main)/archive/*`
  - **ExternalSignals** — `src/components/ExternalSignals.tsx`

### Backend / воркфлоу

- В приложении есть полноценная “цепочка”:
  1) `POST /api/entries` — сохранение entry с антиспамом и ip-географией
  2) `POST /api/analyze` — фоновой/cron обработчик Claude анализа
  3) `POST /api/verify` — верификация совпадений и апдейт рейтингов/ролей
  4) `POST /api/cluster` — кластеризация и запись сигналов в `clusters`
  5) `GET /api/map-data` — агрегация для карты Noosphere
  6) реакции/комментарии — `api/reactions`, `api/comments`

## Главный “стопор” работоспособности: согласованность кода и схемы Supabase

Даже если сборка и фронтенд рендерятся, **функциональность “на данных” зависит от того, совпадает ли реальная БД с тем, что читает/пишет код**.

### Критично проверить

1) **`entries.type`**
   - Код создаёт entry как `type: 'unknown'`:
     - `src/app/api/entries/route.ts`
   - Но в текущей миграции `001_initial_schema.sql` CHECK ограничивает только:
     - `('dream','premonition')`
   - Если CHECK в вашей БД действительно такой же — INSERT/UPDATE с `unknown` может падать.

2) **Колонки `entries.ip_country_code`, `entries.ip_geography`, `entries.is_quarantine`**
   - Используются в:
     - `src/app/api/entries/route.ts` (insert)
     - `src/app/api/map-data/route.ts` (select activityMap)
     - `src/lib/clustering/index.ts` (фильтрация карантина и чтение географии)
   - В миграциях `001–009` я не вижу добавления `ip_*`/`is_quarantine`.
   - Если их нет в таблице — проект будет падать на runtime запросах к этим полям.

## Достижение целей приложения (оценка по слоям)

### Текущая степень достижения

- **Сбор сигналов (entry)** — **в коде реализовано** (API + UI).
- **ИИ анализ (Claude)** — **в коде реализовано** (endpoint + промпты + обновления записей).
  - Реальное “включение” зависит от наличия `ANTHROPIC_API_KEY`.
- **Верификация совпадений** — **в коде реализовано**.
  - Реальный эффект зависит от:
    - доступности источников событий (`NewsAPI/USGS/Guardian`/и т.п.)
    - качества данных AI и match scoring.
- **Ноосфера (map/index/кластеры)** — **в UI логика присутствует**, данные идут через `GET /api/map-data`.
  - Но она будет работать корректно только если в БД реально есть поля, на которые опирается endpoint (`entries.ip_*`, `clusters.geography_data`).
- **Социальные элементы (reactions/comments/notifications)** — **реализовано** (и UI, и endpoint’ы).

### Итог

С точки зрения **компиляции и структуры приложения** — проект уже выглядит как “работающий продукт”.

С точки зрения **реальной работоспособности “на данных”** — ключевая неопределенность именно в **схеме Supabase** (CHECK constraints и наличие `ip_*`/`is_quarantine`).

## Рекомендованный план следующих шагов (приоритет)

1) **Проверить реальную БД** (таблица `entries`):
   - есть ли `ip_country_code`, `ip_geography`, `is_quarantine`
   - какие CHECK constraints на `entries.type`
2) Привести кода и схемы к одному знаменателю:
   - либо расширить миграции/схему (добавить поля + позволить `unknown`)
   - либо поменять код так, чтобы он писал в `entries.type` только то, что разрешено.
3) Убрать/минимизировать Next build “dynamic server usage”:
   - `reddit-test` вызывается в процессе генерации страниц и конфликтует с `no-store fetch`.
4) UI polish:
   - перевести hard-coded RU тексты (тип записи в `EntryCard`, “Вернуться в ленту” и т.д.) на next-intl
   - добавить user-friendly error states для API вызовов.

