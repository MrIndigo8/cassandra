# CASSANDRA

Платформа коллективного предчувствия: записи снов и предчувствий, AI-анализ, сопоставление с реальными событиями и верификация.

Стек: Next.js 14 (App Router), TypeScript, Supabase, Anthropic Claude, Tailwind, `next-intl` (ru/en).

## Быстрый старт

1. Клонировать репозиторий.
2. Установить зависимости:

```bash
npm install
```

3. Скопировать переменные окружения из `.env.example` в `.env.local` (если файла-примера нет — ориентируйтесь на перечень в `docs/ai-project-knowledge/07-qa-build-health-risks.md`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ключи service role Supabase, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` / `VERCEL_URL`, ключ Anthropic и др.).

4. Применить миграции к проекту Supabase:

```bash
npx supabase db push
```

(или через Dashboard SQL — см. `supabase/migrations/`.)

5. Запуск в режиме разработки:

```bash
npm run dev
```

Откройте `http://localhost:3000`.

## Архитектура и документация

Структурированное описание слоёв, API, схемы БД, UI и рисков — в каталоге [`docs/ai-project-knowledge/`](docs/ai-project-knowledge/README.md):

| Документ | Содержание |
|----------|------------|
| [01-scope-and-methodology.md](docs/ai-project-knowledge/01-scope-and-methodology.md) | Область обзора и методология |
| [02-architecture-layers.md](docs/ai-project-knowledge/02-architecture-layers.md) | Стек и границы слоёв |
| [03-data-flow-and-pipeline.md](docs/ai-project-knowledge/03-data-flow-and-pipeline.md) | Потоки данных и пайплайн |
| [04-api-inventory.md](docs/ai-project-knowledge/04-api-inventory.md) | HTTP API |
| [05-database-schema-notes.md](docs/ai-project-knowledge/05-database-schema-notes.md) | Схема БД и замечания |
| [06-ui-ux-inventory.md](docs/ai-project-knowledge/06-ui-ux-inventory.md) | Маршруты и UI |
| [07-qa-build-health-risks.md](docs/ai-project-knowledge/07-qa-build-health-risks.md) | Тесты, сборка, риски |

Дополнительно: [`docs/DATA_FLOW.md`](docs/DATA_FLOW.md), [`docs/CRON_TOUCHPOINTS.md`](docs/CRON_TOUCHPOINTS.md), [`docs/RLS_AUDIT.md`](docs/RLS_AUDIT.md).

## Cron и фоновые задачи

- Оркестратор **`POST /api/cron`** последовательно вызывает защищённые подмаршруты (analyze, verify, coherence и др.) с заголовком `Authorization: Bearer <CRON_SECRET>`.
- Отдельные задачи: **`POST /api/analyze`**, **`POST /api/process-touchpoints`**, облегчённый батч — **`POST /api/process-touchpoints-light`** (см. `docs/CRON_TOUCHPOINTS.md`).

Локальная проверка cron-цепочки:

```bash
curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

## Деплой

- **Vercel:** задать те же переменные окружения, что и локально; `CRON_SECRET` должен совпадать с тем, что используется в вызовах cron.
- **Supabase:** применить миграции, в том числе **027** и **028** (см. QA-док).
- **Realtime:** включить для таблицы `notifications`, если используется колокольчик уведомлений.

## Известные ограничения

- На **Vercel Hobby** встроенный cron выполняется **не чаще одного раза в сутки** — фактические задержки touchpoints могут быть заметно больше интервалов 2 ч / 24 ч; для более частой обработки см. внешний cron на `process-touchpoints-light` в `docs/CRON_TOUCHPOINTS.md`.
- **Weekly digest** (`POST /api/weekly-digest`) по умолчанию генерирует рассылку только в **воскресенье UTC**; для отладки есть `?force=1`.

## Проверка качества

```bash
npm run lint
npm run test
npm run build
```

## Ссылки для ИИ и сопровождения

См. корневые файлы `AI_CONTEXT_INDEX.md`, `PROJECT_STRUCTURE.md` и др. по списку в прежних секциях README при необходимости.
