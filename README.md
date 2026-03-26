# CASSANDRA

Next.js + Supabase + Claude project for collecting dream/premonition signals, analyzing them with AI, and comparing with real-world events.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Main Stack

- Next.js App Router + TypeScript
- Supabase (Auth, Postgres, RLS, Realtime, Storage)
- Anthropic Claude (`@anthropic-ai/sdk`)
- Tailwind CSS + PostCSS
- i18n via `next-intl` (`ru`/`en`)

## Main App Areas

- `src/app/[locale]/(auth)` — login/register
- `src/app/[locale]/(main)/feed` — feed + realtime
- `src/app/[locale]/(main)/entry/[id]` — entry details + reactions/comments
- `src/app/[locale]/(main)/noosphere` — map + cluster analytics
- `src/app/[locale]/(main)/events` — verification matches + world events
- `src/app/[locale]/(main)/archive` — historical cases

## Background Endpoints

- `POST /api/analyze` — AI analysis of entries
- `POST /api/verify` — match verification
- `POST /api/cluster` — clustering/anomaly detection
- `GET /api/map-data` — noosphere map data

## AI Handoff Files (important)

Read these files first for up-to-date context:

1. `AI_CONTEXT_INDEX.md` (entry point for AI)
2. `WORKABILITY_AND_GOAL_ACHIEVEMENT.md`
3. `UI_REVIEW_AND_PROPOSED_CHANGES.md`
4. `DATABASE_AND_SCHEMA_ALIGNMENT.md`
5. `BUGS_RISKS_AND_GAPS.md`
6. `PROJECT_STRUCTURE.md`
7. `ARCHITECTURE_AND_DATA_FLOW.md`
8. `STYLES_AND_CODING_STANDARDS.md`
9. `PROJECT_GOALS_AND_DESIGN_DECISIONS.md`

## Verification Commands

```bash
npm run lint
npm run build
```
