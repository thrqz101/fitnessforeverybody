# Architecture

## Purpose

Fitness for Everybody is a bilingual (Chinese and English) nutrition tracker. A user describes a meal in natural language; the app splits it into food entries with per-item nutrition, adds confirmed entries to the current day, compares the totals with a personalised macro target and recommends the next meal.

## System overview

```text
Browser (React client components)
  │  fetch / NDJSON stream
  ▼
Next.js 14 App Router on Vercel  ── src/app/api/**/route.ts
  │                    │
  │                    ├── LLM provider (MiniMax / DeepSeek / ccswitch / DashScope, OpenAI-compatible)
  │                    ├── Tavily web search (brand and packaged-food nutrition)
  │                    ├── TypeSafe Jev router (optional, FOOD_ROUTER=jev)
  │                    └── Exa web search (nutrition agent only)
  ▼
Supabase: Postgres + Auth (email one-time code) + RLS
```

The app runs in one of two modes, decided by configuration:

| Mode | When | Storage |
| --- | --- | --- |
| Cloud | `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are set and the user is signed in | Supabase is the source of truth; the browser keeps no account data in shared `localStorage` keys |
| Local | Supabase is not configured (`AuthProvider` status `disabled`) | Profile, day and foods live in `localStorage` |

## Ownership boundary

All application code lives in `src/`. Data, scripts and database files stay at the repository root.

```text
src/
  app/                    Routes only: pages, API route handlers, the root layout
    _shell/               Page composition: AppRoot (providers + workspace), AppShell (nav, hero, footer), app-shell.css
    api/**/route.ts       HTTP boundary: auth → parse input → call a feature or shared/api → respond
  features/
    recognition/          Text → food entries (POST /api/food-ai)
    recommendation/       Next-meal recommendations (POST /api/recommend-ai)
    profile/              Settings form, BMR and macro multiplier confirmation
    daily-log/            Today's dashboard, training calendar, client state (useFitnessState)
    account/              Sign-in, account and legacy-import dialogs
    feedback/             Feedback dialog
    agent/                Function-calling nutrition agent (POST /api/nutrition-agent)
  shared/
    domain/               Cross-feature types and pure rules: nutrition targets, macro labels,
                          recommendation fit, score, dates, feedback progress, search evidence
    catalog/              Food catalogue (fixed servings) and the per-100g nutrition database loader
    api/                  Browser API client and server-side validation, mappers, error mapping
    supabase/             Supabase clients (browser, session, service role), session middleware
    auth/                 AuthProvider and sign-in helpers
    i18n/                 Language context, translation tables
    ui/                   Generic components: Dialog, LanguageSwitch, number-input helpers
  middleware.ts           Refreshes the Supabase session cookie
data/                     Brand catalogue, per-100g database (full copy is local only), recipes
scripts/nutrition/        Builds the full per-100g database from pinned USDA archives (run on Vercel builds)
scripts/dev/              Real-backend smoke tests
supabase/migrations/      Schema, RLS and database functions
supabase/tests/           SQL scenario tests
tests/                    Node test runner suites and the TypeScript test loader
```

Inside a feature, code is split by kind:

| Folder | Holds | May import |
| --- | --- | --- |
| `domain/` | Pure functions, types, prompts and static data | `shared/domain`, `shared/catalog`, `shared/i18n` utilities, other `domain/` files |
| `server/` | Code that calls Supabase, LLMs or web APIs and needs secrets | `domain/`, `shared/*` |
| `ui/`, `state/` | Client components and hooks | `domain/`, other features' `ui/` and `domain/`, `shared/*` |

## Layering rules

1. `shared/` never imports `features/` or `app/`.
2. `domain/` does not import React, Next.js, Supabase, or any `server/` or `ui/` module. Two recognition domain modules read configuration defaults from the environment (`FOOD_ROUTER`, `TYPESAFE_*`); network access is always injected (`fetcher`).
3. `ui/` and `state/` never import a `server/` module. The modules that hold the Supabase service-role key (`shared/supabase/admin.ts`, `shared/supabase/api-auth.ts`) import `server-only`, so a client import fails the build.
4. `server/` modules are imported only by `app/api` route handlers and by other `server/` modules of the same feature.
5. `app/` holds no business rules. A route handler authenticates, reads input, delegates and maps the result to a response. Page composition lives in `app/_shell`.

Features do not expose barrel `index.ts` files: a barrel would mix client and server code in one import and let server code reach the client bundle.

## Request boundary

All writes go through Next.js API routes. A route calls `requireApiUser()`, which verifies the session cookie and returns the user plus a service-role client. The route then calls a database function with `p_user` taken from the session. Browsers can only `select` their own rows through RLS, and the database functions are not executable by `anon` or `authenticated`. See [Supabase](docs/supabase.md).

### Recording a meal

```text
Dashboard (daily-log/ui)
  └─ requestFoodAi (recognition/ui/recognition-client)   POST /api/food-ai, Accept: application/x-ndjson
       └─ route.ts → streamRecognition(recognizeFood)
            1. beginCloudRecognition      idempotent by requestId; replays finished results
            2. explicit-items             vague or more than 6 foods → early reply
            3. brand-catalog              brand match always precedes generic food values
            4. local-match                per-100g DB for explicit weights, fixed catalogue servings otherwise
            5. route decision             rules (default) | Jev | LLM → local_exact | brand_search | ai_estimate | not_food
            6. tavily-search + llm-steps  brand_search: search, then extract foods from the sources
            7. llm-client                 ai_estimate: one estimation call, optional repair call
            8. ai-foods                   normalise foods, merge with local matches, attach search evidence
            9. persist                    cloud mode: store drafts before the result is reported
       ◄─ progress events, then one result event
User confirms a draft → POST /api/entries/[id]/confirm → confirm_entry → day totals recomputed
```

Details, fallbacks and diagnostics are specified in [recognition](docs/recognition.md).

## Environments

| Environment | Web | Supabase | Notes |
| --- | --- | --- | --- |
| Local development | `npm run dev` on `localhost:3000` | The production project | Secrets resolved by `op run`; treat writes as production writes |
| Production | Vercel (`https://fitnessforeverybody.vercel.app`) | Same project | `vercel.json` builds the full nutrition database before `next build` |

Environment variables are listed with their visibility in `.env.example`; setup is described in [setup](docs/setup.md).

## Verification contract

A change is complete when:

1. `npm run typecheck` passes;
2. `npm test` passes;
3. `npm run build` passes when routing, configuration or bundling may be affected;
4. affected user flows were checked in a browser, including a mobile-width layout, for UI changes;
5. backend or recognition changes were checked with `npm run api:smoke` and `npm run auth:smoke` when the user authorised those production writes.
