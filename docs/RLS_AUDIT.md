# Аудит RLS для таблиц с клиентским доступом (anon key)

Дата: 2026-04. Источник политик: `supabase/migrations/*.sql`. Клиентский код: `createClient()` из `@/lib/supabase/client` в компонентах и части страниц.

## Таблицы, к которым ходит браузерный клиент

| Таблица / ресурс | Операции (клиент) | RLS | Политики | Замечание |
|------------------|-------------------|-----|----------|-----------|
| `notifications` | SELECT, UPDATE | Да (`001_initial_schema.sql`) | `notifications_select`, `notifications_update` | Выборка по своему `user_id`; соответствует запросам в `NotificationBell`. |
| `users` | SELECT, UPDATE | Да | `users_select_public`, `users_update_own` | Профиль / лента (`FeedClient`), редактор профиля. |
| `entries` | SELECT (лента, профиль) | Да | `entries_select` | Политика учитывает публичность / владельца (см. миграцию 001). |
| `reactions`, `comments` | SELECT, INSERT, DELETE (через UI/API) | Да (`009_comments_reactions.sql`) | Чтение публичное, запись с авторизацией | Часть загрузки — серверные страницы + API `/api/comments`. |
| `community_confirmations` | SELECT / INSERT по сценарию | Да (`018_phase1_alignment.sql`) | См. политики | Используется в ленте. |
| `matches`, `clusters` | SELECT | Да | См. `003_verification`, 001 | Discoveries и др. — в основном через серверные компоненты с SSR-клиентом. |
| `historical_cases` | SELECT | Да (`006_archive.sql`) | Публичное чтение | Архив. |
| Storage `entry-images` / bucket | upload | Да (`023_user_profile_fields.sql` — avatars; для entry-images проверить политики storage в миграциях) | Политики объектов | `ImageUpload.tsx` — загрузка в bucket. |

## Вывод

- Для основных таблиц (`users`, `entries`, `notifications`, `comments`, `reactions`) в миграциях **RLS включён** и заданы политики; отдельная миграция в рамках этого аудита **не добавлялась**.
- Убедитесь в проде, что для **Realtime** на `notifications` включена репликация, как в чек-листе деплоя.
- При появлении новых клиентских `.from('…')` — повторить grep по `src/components` и `src/app/[locale]` и сверить с `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`.

## Подзапрос: entries и приватность

Политика `entries_select` в `001_initial_schema.sql` должна ограничивать чтение чужих приватных записей; при изменении схемы (`is_public`, `visibility`) — обновить политику в новой миграции.
