# Styles & Coding Standards

Документ фиксирует “стили” (Tailwind, глобальные CSS утилиты), линтеры/форматирование и типографику/конвенции кода в проекте `CASSANDRA`.

## Стек стилей

- Tailwind CSS (`tailwind.config.ts`)
  - Поддержка `dark` класса на `html` есть в `src/app/layout.tsx`, но в `globals.css` отдельные dark-стили не реализованы (только базовые стили тела).
  - В `globals.css` используется `@layer base` и `@layer components`.
- PostCSS (`postcss.config.mjs`)
  - Плагин `tailwindcss`.
- Глобальные стили: `src/app/globals.css`
  - `@tailwind base/components/utilities`
  - Переопределяет `body`, scrollbar и вводит набор компонентов/утилит.

## Tailwind конфигурация (`tailwind.config.ts`)

- `content` включает:
  - `./src/pages/**/*.{js,ts,jsx,tsx,mdx}` (замечание: папки `src/pages` в проекте нет, т.к. App Router)
  - `./src/components/**/*...`
  - `./src/app/**/*...`
- `theme.extend.colors` определены токены:
  - `primary` с вариациями `DEFAULT` и `hover`
  - `secondary`
  - `background`, `surface`, `border`
  - `text.primary`, `text.secondary`
  - `accent`
- `fontFamily`
  - `sans`: `Inter`, `system-ui`, `sans-serif`
  - `mono`: `var(--font-geist-mono)`, `monospace`
- `borderRadius`
  - `xl`, `2xl`

## Глобальные CSS компоненты (`src/app/globals.css`)

### Base слой

- `body`:
  - `background-color: #FFFFFF`
  - `color: #1F2937`
  - `min-height: 100vh`
  - `@apply antialiased`
  - `font-family: "Inter", system-ui, sans-serif`
- Scrollbar:
  - 6px ширина/высота
  - трек и thumb на базе #F9FAFB/#E5E7EB и хов на #6B7280
- Фокус:
  - `*:focus-visible` включает ring (цвет #10B981) через кастомные CSS переменные `--tw-ring-color`, `--tw-ring-offset-color`.

### Components слой

Определены “готовые” классы:

- `.card` и `.glass` (card-стиль + переходы/скругления)
- `.btn-primary`, `.btn-secondary`, `.btn-gold`
- `.input`, `.textarea`, `.label`
- Бейджи:
  - `.badge-dream`, `.badge-premonition`, `.badge-match`, `.badge-role`
  - `.badge-observer`, `.badge-chronicler`, `.badge-sensitive`, `.badge-oracle` как alias на `.badge-role`
- `.divider`
- `.skeleton`

### Utilities слой

- `.text-gradient` задаёт цвет #10B981 (важно: фактически не градиент)
- `.text-glow` (заглушка `text-shadow: none`)
- `.scrollbar-hide` прячет скроллбар

## “Дизайн-токены” и обнаруженные пробелы в Tailwind

В текущем UI используются классы, которых **нет** в `tailwind.config.ts` и/или нет в `globals.css`:

- `bg-void-border`, `border-void-border`, `bg-void`, `bg-cosmos`, `bg-aurora`
- `text-mist`, `text-mist-dim`, `text-mist-faint`
- `bg-dream/10`, `border-dream/20`
- `bg-match/10`, `border-match/20`
- а также анимации:
  - `animate-pulse-slow`
  - `animate-ping-slow`
- `shadow-glow-sm`
- `text-accent-light`

Если эти токены не определены в Tailwind (через `theme.extend.colors`/`animation`/плагины или через CSS переменные), то:

- часть “визуальных” классов не будет работать (CSS-класса просто не сгенерируется Tailwind’ом)
- при сборке возможно не критично (Tailwind не падает), но визуальные эффекты будут отсутствовать

## Линтеры/типизация/конвенции

### TypeScript

- `tsconfig.json`:
  - `strict: true`
  - `noEmit: true`
  - `moduleResolution: "bundler"`
  - `paths`: `@/* -> ./src/*`
  - Включены `**/*.ts`/`**/*.tsx`

### ESLint

- `.eslintrc.json`:
  - `extends`: `next/core-web-vitals`, `next/typescript`

### Next.js

- `next.config.mjs` пустой (кроме type annotation)
- `src/app/middleware.ts` есть (см. `src/middleware.ts` и `src/lib/supabase/middleware.ts`)

## Fonts

- В `src/app/layout.tsx` используется `next/font/google` для `Inter`, с переменной `variable: "--font-geist-sans"`.
- В `tailwind.config.ts` `mono` опирается на `var(--font-geist-mono)`.
- В `src/app/globals.css` `font-family` в `body` — `"Inter"`.
- Папка `src/app/fonts` содержит `.woff` файлы, но `@font-face`/подключение этих шрифтов в CSS не найдено (значит существующие фонты, вероятно, не подключены).

