# UI review — предложения по улучшениям

## Что уже исправлено в рамках этого захода

- **Tailwind tokens + анимации**: добавлены в `tailwind.config.ts` те классы, которые реально используются в UI:
  - цвета: `bg-void-border`, `bg-void`, `bg-cosmos`, `bg-aurora`, `text-mist*`, `bg-cassandra-*`, `bg-dream/10`, `bg-match/10`, `danger`, `text-accent-light`
  - анимации: `animate-fade-in`, `animate-pulse-slow`, `animate-ping-slow`
  - тень: `shadow-glow-sm`
- **Locale-aware navigation**:
  - `EntryClient` теперь использует `Link` из `@/navigation`
  - `NotificationBell` теперь использует `useRouter` из `@/navigation`
  - это снижает риск сломанных переходов на `/en/...` / `/ru/...`

## Ключевые проблемы UI (быстрое резюме)

### 1) i18n: hard-coded RU-тексты и бейджи

В нескольких компонентах названия типов/кнопок/подписей захардкожены на русском (например “Сон”, “Предчувствие”, “Вернуться в ленту”, заголовки в “Noosphere/Events”).

Рекомендация:
- использовать `next-intl` (как минимум для `type labels` и навигации)
- убрать строки из `EntryClient`/`EntryCard` и заменить на ключи translation files.

### 2) Локальная доступность (accessibility)

Есть места, где кликабельные элементы лучше пометить:
- `aria-label` для иконок/кнопок
- `aria-pressed` для реакций (toggle)
- фокус-стили и “клик по кнопке не должен случайно триггерить родителя” (особенно внутри `Link`).

### 3) Error handling и feedback

В UI редко показывается пользовательский “что пошло не так”.

Рекомендация:
- добавить локальные `error` state в:
  - `FeedClient` (loadMore/filter)
  - `EntryReactions` и `EntryComments` (POST/DELETE)
  - `ExternalSignals` (fetch `/api/external-sync`)
  - `VerifyButton` (ошибки верне наружу, но и дать инструкцию).

## Файл за файлом: что улучшить и как

### `src/app/[locale]/page.tsx` (landing)

- **Токены визуала**: теперь определены, но стиль зависит от того, что фон/контраст настроены корректно (например `bg-void/50` и `text-mist*`).
- **LanguageRedirect**:
  - сейчас встраивается в body на landing
  - стоит убедиться, что он не вступает в конфликт с middleware редиректами (иначе может быть “мигание” маршрута).
- **Декоративные элементы**:
  - декоративные `div` должны иметь `aria-hidden` (или быть вне accessibility tree).

### `src/app/[locale]/(auth)/login/page.tsx` и `register/page.tsx`

- **Consistency**:
  - классы визуала после добавления tokens должны работать корректно.
- **Форма**:
  - добавить показ ошибки под полями (а не только общий блок).
- **UX**:
  - добавить “disabled while submitting” + spinner уже частично есть — но стоит унифицировать.

### `src/app/[locale]/(main)/feed/FeedClient.tsx`

- **Realtime + дубликаты**:
  - realtime INSERT может добавлять entry, который уже есть в `entries` (при быстрых действиях/фильтре).
  - улучшение: перед `setEntries` делать dedupe по `entry.id`.
- **Пагинация**:
  - `range(from,to)` корректна по формуле, но `hasMore` вычисляется через `data.length===PAGE_SIZE`.
  - если БД/фильтр меняют плотность результатов, `hasMore` может вести себя странно.
  - улучшение: хранить `total` или запрашивать “1 extra record” для проверки.
- **Пустое состояние**:
  - сейчас `p` в empty state фактически пустой (`{filter === 'all' ? '' : ''}`).
  - улучшение: добавить осмысленную подсказку на основании filter.
- **Типизация**:
  - payload из realtime подписки сейчас приводится через `any`/импорт типов.
  - улучшение: типизировать `payload.new` как `Entry` или `Entry & { user_id: ... }`.

### `src/components/InlineEntryForm.tsx`

- **Race condition**:
  - `fetch('/api/analyze')` делается fire-and-forget.
  - параллельные вызовы (cron + immediate) потенциально могут анализировать одну и ту же запись.
  - улучшение: в `/api/analyze` использовать атомарный “claim” (например, обновить `ai_analyzed_at` в момент выдачи в обработку) или флаг `analysis_in_progress`.
- **UX ошибки**:
  - сейчас ошибка формы показывается, но ошибок из фонового analyze не видно.
  - улучшение: либо показывать “анализ запущен”, либо логировать в UI через баннер.
- **Collapse**:
  - `isExpanded` не схлопывается при blur/клике вне — можно улучшить UX.

### `src/components/EntryCard.tsx`

- **Пересечение Link и кликов по кнопкам**:
  - внутри `Link` есть `EntryReactions` с обработчиками, которые частично предотвращают поведение родителя.
  - улучшение: использовать `e.stopPropagation()`/`e.preventDefault()` точечно на кликах по reaction/comment, чтобы избежать “случайного перехода”.
- **i18n**:
  - бейджи типов до сих пор захардкожены (“Сон”, “Предчувствие”...).
  - улучшение: вынести в translation.
- **line-clamp**:
  - используется `line-clamp-*`. Если плагин не включён — может не работать.
  - улучшение: убедиться, что `line-clamp` доступен (Tailwind plugin).

### `src/components/EntryReactions.tsx`

- **Оптимистичная UI-логика**:
  - сейчас делается оптимистичное обновление и затем POST без rollback при ошибке.
  - улучшение: try/catch + откат state или показать ошибку.
- **Loading**:
  - есть `loading`, но UI может зависнуть без try/catch (если запрос упадёт).
  - улучшение: `finally` для сброса.
- **Accessibility**:
  - реакции — toggle. Стоит добавить `aria-pressed={...}`.

### `src/components/EntryComments.tsx`

- **Realtime overhead**:
  - на каждый INSERT делается повторный fetch всех комментариев для entry.
  - улучшение: либо расширить подписку и дополнять, либо делать ограниченный fetch.
- **Валидация**:
  - добавление комментария без проверки лимитов на клиенте (сервер ограничит, но UX хуже).
  - улучшение: ограничить длину (например 500) + показать счетчик.
- **Профиль автора**:
  - условие удаления сравнивает `comment.users?.username === currentUsername`, но `currentUsername` может быть undefined.
  - улучшение: передавать гарантированный currentUsername или сравнивать по `user.id` (если доступно).

### `src/components/PushBanner.tsx`

- **Анимация**: теперь токен `animate-fade-in` добавлен.
- **Service worker**:
  - запрос разрешения и регистрация завязаны на `'/sw.js'`.
  - улучшение: проверить, что `public/sw.js` действительно есть; иначе push не заработает.
- **Повторные schedule**:
  - после получения permission schedule может ставить `setInterval` без cleanup.
  - улучшение: хранить `timerId`/`intervalId` в ref и чистить при скрытии/разлогине.

### `src/components/layout/Header.tsx` и `NotificationBell.tsx`

- **Header**:
  - locale switch и router.replace — логика в целом ок.
  - улучшение: добавить guard от лишних перерендоров (например, если locale уже тот же).
- **NotificationBell**:
  - исправлено: locale-aware routing.
  - улучшение:
    - показать пустое состояние и ошибки fetch
    - типизировать `Notification` (сейчас `type/message/data/status` — общие string/unknown).

### `src/components/LanguageRedirect.tsx`

- **Логика редиректа**:
  - это клиентский эффект на первом визите без сохранённого locale.
  - улучшение: сделать debounce (или хранить “redirectedOnce”), чтобы избежать циклов при сложных сценариях.

### `src/app/[locale]/(main)/entry/[id]/EntryClient.tsx`

- **Locale назад**:
  - исправлено (см. `Link` из `@/navigation`).
- **Тексты и типы**:
  - “Сон/Предчувствие”, “Интенсивность”, “Поделиться сигналом” лучше перевести в next-intl.

### `src/app/[locale]/(main)/noosphere/*`

- **`NoosphereMap`**:
  - сейчас эвристика маппинга стран очень ограниченная (ручной `countryNameToISO` + `countryCoords`).
  - улучшение: получать ISO/коды из `world-atlas` props или расширять формат `map-data` (например, возвращать и ISO-код).
  - для tooltip слой “events” использует `window.open` — ок, но стоит добавить graceful fallback если `event.url` отсутствует.
- **`NoospherePage`**:
  - “growthPercent” может становиться огромным при baseline48h ~ 1.
  - улучшение: добавить upper cap/лог трансформацию или показать confidence/примечание.

### `src/app/[locale]/(main)/events/page.tsx`

- **Серверный фетч**:
  - страница `force-dynamic`, поэтому внешние запросы происходят на каждом рендере.
  - улучшение: использовать кэш/реvalidate в fetch либе (`fetchAllEvents`) там, где это безопасно.
- **VerifyButton**:
  - добавить UI state “в процессе” уже частично есть, но стоит показать “что делать дальше” при успехе.

### `src/components/ExternalSignals.tsx`

- **Типизация**:
  - используется `any[]`.
  - улучшение: типы `ExternalSignal` + `MarketSignal`.
- **Пользовательский feedback**:
  - если `/api/external-sync` недоступен, сейчас просто остаётся пустой UI.

## Если делать следующий шаг “больше кода”, что я бы предложил

1) **Согласовать i18n**: заменить hard-coded RU-тексты на `useTranslations`.
2) **Стабилизировать realtime**: dedupe entries/comments/reactions.
3) **Типизировать ответы API** (zod/utility types) вместо `any`.
4) **Схема Supabase**: подтвердить наличие колонок, на которые опирается `entries`/`map-data`/`clustering`.

