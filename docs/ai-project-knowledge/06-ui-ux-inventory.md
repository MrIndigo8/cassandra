# UI/UX: маршруты, layout, паттерны (для ИИ-анализа)

Документ описывает **что видит пользователь**, как устроена навигация и какие компоненты отвечают за ключевой опыт. Локаль: **`ru`** по умолчанию без префикса, **`en`** с префиксом `/en`.

## Глобальная оболочка

| Элемент | Файл / поведение |
|---------|------------------|
| Шрифты | `Inter`, `Space Grotesk`, `JetBrains Mono` в `[locale]/layout.tsx` |
| Тема | Переключатель в `Header` (хук `useTheme`) |
| Сессия | `AuthProvider` + `useUser` |
| i18n | `NextIntlClientProvider`, сообщения из `messages/*.json` |

## Middleware и доступ

Файл: `src/middleware.ts` (matcher исключает `/api`, `_next`, статику).

- **Supabase session** обновляется через `updateSession` (`src/lib/supabase/middleware.ts`).
- **next-intl** применяется ко всем страничным маршрутам.
- Неавторизованный пользователь перенаправляется на **`/login`**, кроме публичных путей: `/`, `/login`, `/register`, `/terms`, `/privacy`.
- Авторизованный на `/login` или `/register` → **`/feed`**.
- **`/admin/*`**: только роли `architect`, `admin`, `moderator` (проверка таблицы **`users`**); иначе редирект на `/feed`.

## Основное приложение `(main)`

Layout: `src/app/[locale]/(main)/layout.tsx`

- **`Header`** — sticky, `z-50`, высота контейнера **`h-14`** (3.5rem). Навигация: Feed, Discoveries, Map; для роли с правами — ссылка в админку; **NotificationBell**; локаль; тема; профиль.
- **`main`** — `pb-16 md:pb-0` (отступ под мобильную нижнюю навигацию).
- **`MobileBottomNav`** — фиксированная нижняя панель на маленьких экранах.
- **`ConsentBanner`** — баннер согласия (GDPR/контент).

### Страницы (пользователь)

| Маршрут | Назначение UX |
|---------|----------------|
| `/feed` | Лента записей, создание сигналов |
| `/discoveries` | Открытия / находки |
| `/map` | Карта сигналов |
| `/noosphere` | Визуализация ноосферы (карта, данные с API) |
| `/archive` | Архив |
| `/events` | События |
| `/entry/[id]` | Карточка записи, детали, self-report из контекста |
| `/profile/[username]` | Публичный профиль |

### Лендинг и юридическое

| Маршрут | Назначение |
|---------|------------|
| `/` | Лендинг (метаданные в layout на русском) |
| `/privacy`, `/terms` | Юридические страницы |

### Авторизация `(auth)`

| Маршрут | Назначение |
|---------|------------|
| `/login`, `/register` | Вход и регистрация Supabase |

## Админка `(admin)`

Доступ см. middleware. Типичные разделы:

| Маршрут | UX |
|---------|-----|
| `/admin` | Обзор |
| `/admin/users` | Пользователи |
| `/admin/entries` | Записи |
| `/admin/matches` | Матчи |
| `/admin/map` | Карта (админ) |
| `/admin/audit` | Аудит |
| `/admin/settings` | Настройки (в т.ч. research portal toggle) |
| `/admin/ai` | AI-инструменты |
| **`/admin/psyche`** | Тяжёлый клиентский дашборд (recharts, карта): таблица стран, панель страны, графики |

`AdminSidebar` — навигация с иконками (Lucide).

## Уведомления: NotificationBell

Файл: `src/components/layout/NotificationBell.tsx`

- Триггер: кнопка с колокольчиком и бейджем непрочитанных.
- Панель: **slide-over справа**, **`fixed`**, **`top-14`** и **`h-[calc(100%-3.5rem)]`**, чтобы **не перекрывать шапку** (совпадает с `Header` `h-14`).
- Оверлей: затемнение с **`top-14`**, `z-[60]` выше шапки (`z-50`).
- Группировка по датам: Today / Yesterday / This week / Earlier (ключи i18n `notifications.*`).
- Данные: Supabase `notifications`, исключены `scheduled` и `cancelled`; Realtime на INSERT.
- Действия: переход по `entry_id`, `action_target`, для `similar_patterns` → `/map`; self-report через `POST /api/self-report`.

**Замечание UX/i18n:** функция `timeAgoLabel` возвращает короткие английские суффиксы (`now`, `m`, `h`, `d`) — при полной локализации стоит заменить на `next-intl` или `date-fns` с локалью.

## Дизайн-система (кратко)

- Tailwind-токены: `bg-background`, `bg-surface`, `text-text-primary`, `border-border`, `text-primary`, семантика ролей в `Header` (цветные точки).
- Карты: общие константы в `src/lib/geo/worldMap.ts` (URL атласа, ISO, флаги).

## Ключевые зависимости UI

- **lucide-react** — иконки
- **recharts** — графики в Psyche dashboard
- **react-simple-maps** — карты

## Строки интерфейса

- Основной источник: **`messages/ru.json`**, **`messages/en.json`**
- Часть текстов уведомлений может приходить из **БД** (заголовки при планировании touchpoints в `schedule-touchpoints.ts` на русском) — для мультиязычного продукта это технический долг: лучше шаблоны по `locale` или ключи + подстановка на клиенте.
