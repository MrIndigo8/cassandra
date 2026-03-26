# AI Context Index (Current Project State)

This file is the main entry point for any AI agent that needs fast and accurate context about the current CASSANDRA state.

## Read Order (recommended)

1. `WORKABILITY_AND_GOAL_ACHIEVEMENT.md`
2. `DATABASE_AND_SCHEMA_ALIGNMENT.md`
3. `BUGS_RISKS_AND_GAPS.md`
4. `UI_REVIEW_AND_PROPOSED_CHANGES.md`
5. `PROJECT_STRUCTURE.md`
6. `ARCHITECTURE_AND_DATA_FLOW.md`
7. `STYLES_AND_CODING_STANDARDS.md`
8. `PROJECT_GOALS_AND_DESIGN_DECISIONS.md`

## What Changed Recently

- Docs were refreshed with **v2 updates** to reflect:
  - i18n routing under `src/app/[locale]/...`
  - expanded API surface (`comments`, `reactions`, `external-sync`, `map-data`, `self-report`)
  - new Supabase migrations 005..009
  - current UI and data-flow reality
- Build blockers were fixed:
  - `dotenv` installed
  - stale `@ts-expect-error` removed from `src/scripts/seed-archive.ts`

## Current Validation Status

- `npm run lint`: passing
- `npm run build`: passing

## High-Priority Risk Checks for AI

When doing any backend/data work, verify these first:

1. `entries.type` constraints vs code using `'unknown'`.
2. Presence of columns used in code:
   - `entries.ip_country_code`
   - `entries.ip_geography`
   - `entries.is_quarantine`
3. Runtime behavior around `api/reddit-test` during build/static generation.

## Key Code Entry Points

- Middleware/auth/i18n:
  - `src/middleware.ts`
  - `src/lib/supabase/middleware.ts`
  - `src/navigation.ts`
- Core flows:
  - `src/app/api/entries/route.ts`
  - `src/lib/analysis/index.ts`
  - `src/lib/verification/index.ts`
  - `src/lib/clustering/index.ts`
  - `src/app/api/map-data/route.ts`
- UI core:
  - `src/app/[locale]/(main)/feed/FeedClient.tsx`
  - `src/app/[locale]/(main)/noosphere/NoosphereMap.tsx`
  - `src/components/InlineEntryForm.tsx`
  - `src/components/EntryCard.tsx`
  - `src/components/layout/NotificationBell.tsx`

