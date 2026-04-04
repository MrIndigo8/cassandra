# Инвентарь HTTP API (`src/app/api`)

Все перечисленные обработчики — файлы `route.ts`. Методы по умолчанию смотрите в коде; cron-задачи обычно ожидают **`Authorization: Bearer CRON_SECRET`** (см. `src/lib/auth/verifyCron.ts`).

## Администрирование

| Путь | Назначение |
|------|------------|
| `POST /api/admin/ai/run` | Запуск админских AI-операций |
| `GET/POST? /api/admin/audit` | Аудит |
| `GET/POST? /api/admin/entries` | Управление записями |
| `POST /api/admin/generate-snapshots` | Генерация geo/global psyche snapshots |
| `GET /api/admin/psyche-data` | Данные для дашборда Psyche |
| `GET/POST? /api/admin/matches` | Матчи |
| `GET/POST? /api/admin/settings` | Системные настройки |
| `GET /api/admin/stats` | Статистика |
| `GET/POST? /api/admin/users` | Пользователи |
| `GET/PATCH? /api/admin/users/[id]` | Пользователь по id |

## Основной продукт и фон

| Путь | Назначение |
|------|------------|
| `POST /api/entries` | Создание записи (сессия пользователя) |
| `POST /api/analyze` | Пакетный/точечный анализ записей (cron) |
| `POST /api/verify` | Верификация / матчи |
| `POST /api/coherence` | Когерентность |
| `POST /api/cluster` | Кластеризация |
| `POST /api/recalculate-scores` | Пересчёт скоров |
| `POST /api/reality-snapshot` | Снимок «реальности» |
| `POST /api/external-sync` | Внешняя синхронизация сигналов |
| `GET/POST /api/cron` | Оркестратор ежедневных задач |

## Уведомления и удержание

| Путь | Назначение |
|------|------------|
| `POST /api/process-touchpoints` | Обработка `scheduled` уведомлений |
| `POST /api/weekly-digest` | Недельный дайджест |

## Пользователь и социальное

| Путь | Назначение |
|------|------------|
| `GET/POST? /api/profile` | Профиль |
| `GET/POST? /api/profile/entries` | Записи профиля |
| `POST /api/comments` | Комментарии |
| `POST /api/reactions` | Реакции |
| `POST /api/views` | Просмотры |
| `POST /api/self-report` | Самоотчёт по записи |

## Данные для UI карт / ленты

| Путь | Назначение |
|------|------------|
| `GET /api/map-data` | Данные карты |
| `GET /api/noosphere-data` | Ноосфера |
| `GET /api/feed/stats` | Статистика ленты |
| `GET /api/landing-stats` | Лендинг |
| `GET/POST? /api/events` | События |
| `GET/POST? /api/events/matches` | Матчи событий |

## Прочее

| Путь | Назначение |
|------|------------|
| `GET /api/auth/callback` | OAuth callback Supabase |
| `POST /api/transcribe` | Транскрипция (если используется) |
| `POST /api/morning-digest` | Утренний дайджест |
| `POST /api/community-confirm` | Подтверждение сообщества |
| `GET /api/news-test` | Тест новостей |
| `POST /api/seed` | Сид (осторожно в prod) |
| `GET /api/og` | OG-изображения |

*Точные HTTP-методы и тела запросов — в исходниках соответствующих `route.ts`.*
