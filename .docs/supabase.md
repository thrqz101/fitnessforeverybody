# Supabase Backend

Read this guide before changing `supabase/`, `src/shared/supabase`, `src/shared/api` or any API route that writes data. Production-write rules are in [AGENTS.md](../AGENTS.md#production-data-safety).

## Access model

- Browsers can only `select` their own rows, through RLS policies on every public table.
- Every write goes through a Next.js API route. The route verifies the session with `requireApiUser()`, takes the user id from the session and calls a database function with the service-role client (`shared/supabase/admin.ts`).
- Database functions are executable only by `service_role`; `anon` and `authenticated` cannot call them, so targets, recognition output, flow counts and the effective flag cannot be spoofed from the browser.
- Sign-in uses Supabase Auth email one-time codes. `src/middleware.ts` refreshes the session cookie on page requests. API routes skip the middleware: `requireApiUser()` verifies the session and refreshes the cookie itself, which saves one Auth round trip per request.

## Tables

| Table | Holds |
| --- | --- |
| `profiles` | One row per user: body data, goal, custom multipliers, feedback progress, legacy-import state, `is_test`, optimistic `version` |
| `recognition_requests` | One row per recognition `request_id`: input text, status, route, output; makes recognition idempotent |
| `food_entries` | Draft and confirmed food entries with base macros and portion scale |
| `daily_activity` | One row per user and day: day settings, target snapshot, totals, flows, score, effective flag, finalisation |
| `feedback` | Feedback messages, de-duplicated by a client id |
| `job_log` | Results of scheduled jobs |

All macro objects are `{ protein, carbs, fat, calories, fiber }` with numbers in `[0, 20000]` (`public.macros_valid`). `public.scale_macros` uses the same rounding as `scaleMacros` in `src/shared/domain/nutrition.ts`; keep them in sync.

## Day lifecycle

A day is an `Asia/Shanghai` calendar day (`public.app_today()`). It is writable only while it is today and not finalised. `pg_cron` runs `public.finalize_due_days()` at Beijing midnight and every 15 minutes as a sweep; finalisation recomputes the day from confirmed entries and sets the effective flag (at least two confirmed recognition flows and a weighted score of at least 0.5). Imported past days are finalised and marked `migrated`, with no flows or verdict.

## Functions used by the API

| Function | Called by |
| --- | --- |
| `get_cloud_state` | `POST /api/sync`: profile, recent days and entries in one round trip |
| `ensure_profile`, `upsert_profile` | `GET /api/session`, `PUT /api/profile` (version-checked) |
| `upsert_day_snapshot` | `PUT /api/day`, `PUT /api/profile`; confirmations and deletions recompute the day inside the database (`recompute_day`) |
| `begin_recognition`, `complete_recognition` | `POST /api/food-ai` |
| `create_manual_entry`, `confirm_entry`, `update_entry_portion`, `delete_entry` | `/api/entries/**` |
| `update_feedback_progress`, `submit_feedback` | `/api/feedback-progress`, `/api/feedback` |
| `import_local_records` | `POST /api/import` |
| Auth admin `deleteUser` | `DELETE /api/account` (requires the typed email); rows are removed by `on delete cascade` |

Functions raise named exceptions (`version_conflict`, `day_closed`, `day_not_ready`, `entry_not_found`, `entry_deleted`, `request_conflict`, `rate_limited`, `invalid_*`), which `shared/api/errors.ts` maps to HTTP statuses and stable codes. Recognition is limited to 60 requests per hour and 300 per day per user; feedback to 10 per window.

## Operations views

The `ops` schema holds `security_invoker` views for the owner: `daily_effective_users`, `recognition_inputs` and `feedback_inbox`. They exclude `is_test` users and are not exposed to `anon` or `authenticated`.

## Migrations

- Migrations live in `supabase/migrations/<timestamp>_<name>.sql` and are applied in order. Applied migrations are immutable; every change is a new migration.
- A schema change needs the user's explicit approval for that exact data-model change, and applying it to the project is a production write.
- After changing a function, re-apply the grants: functions are revoked from `public`, `anon` and `authenticated` and granted to `service_role`.

## Tests

`supabase/tests/scenarios.sql` and `supabase/tests/cloud_state.sql` run as the `postgres` role inside one `DO` block that always ends with an exception, so nothing is committed. Success reads `ERROR: ALL_PASSED: ...`; any other error is a failed assertion. `npm run auth:smoke` checks RLS and function grants with a real signed-in user; `npm run api:smoke` drives every API route with two users, including concurrency and account deletion. See [testing](testing.md).
