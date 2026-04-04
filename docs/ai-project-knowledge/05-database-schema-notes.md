# База данных: миграции и замечания

## Миграции

Файлы в **`supabase/migrations/`**, порядок по префиксу `001` … **`028`**:

- `001_initial_schema.sql` — базовая схема
- `002`–`024` — AI, верификация, кластеры, архив, научный слой, админка, индексы и т.д.
- **`027_psyche_snapshots.sql`** — `symbolic_fingerprints` расширение, `geo_snapshots`, `global_snapshots`, `system_settings` для research
- **`028_notifications_touchpoints.sql`** — расширение enum `notifications.type` / `status`, индексы

При развёртывании все миграции должны применяться **последовательно** к целевой базе.

## Известные точки рассогласования (код ↔ схема)

Эти пункты зафиксированы в правилах проекта и должны проверяться перед изменением логики:

1. **`entries.type`**: в миграциях встречалось ограничение вроде `dream|premonition`, в коде при создании записи используется **`unknown`** до классификации. Любые новые значения типа должны совпадать с constraint в БД.
2. **Поля гео/IP**: код может ссылаться на `ip_country_code`, `ip_geography`, `is_quarantine` — убедиться, что колонки существуют в развёрнутой БД (миграции `011` и др.).
3. **`verification` / join’ы**: в прошлом возможны предположения `profiles` vs **`users`** — при правках `src/lib/verification/` проверять актуальное имя таблицы профилей.

## RLS и роли

- Клиентский Supabase использует **anon key** + политики RLS.
- Админские и cron-маршруты часто используют **service role** через `createAdminClient` и проверку роли в коде (`users.role`: architect, admin, moderator, …).
- Таблицы снимков психики в миграции 027 ориентированы на доступ **админов** — см. политики в SQL.

## Уведомления

После `028`:

- Типы: в т.ч. `engagement`, `weekly_digest`, `collective_alert`, `self_report_reminder`, `match_confirmed`
- Статусы: в т.ч. `pending`, `scheduled`, `cancelled`
- Индексы по `status`, `scheduled_for`, `action_type` для выборок cron’ом

## Realtime

Подписка на **`notifications`** в `NotificationBell` требует включения realtime для таблицы в настройках Supabase.
