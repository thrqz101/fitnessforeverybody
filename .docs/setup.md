# Contributor Setup

## Toolchain

- Node.js 22.6 or later (the test runner imports TypeScript directly) and npm.
- The 1Password CLI (`op`) signed in to the account that holds the project's secrets.
- Python 3 only when rebuilding the full nutrition database (`scripts/nutrition/`).

```sh
npm install
```

## Environment

Secrets never live in files. `.env` (git-ignored) contains only 1Password references; `.env.example` lists every variable with empty values and notes which ones reach the browser.

1. Copy `.env.example` to `.env`.
2. Fill each secret with a reference of the form `op://<vault>/<item>/<field>`. Non-secret switches (`FOOD_ROUTER`, `FOOD_SEARCH_DEPTH`, model names) can be plain values.
3. If several 1Password accounts are signed in, add `export OP_ACCOUNT=<account id or sign-in address>` to your shell profile. The `package.json` scripts do not name an account.
4. If the shell inherits `op://` references from another project, remove them for this command only, for example `env -u SOME_OTHER_OP_REF npm run dev`.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` and the provider's key, base URL and model | Server | LLM for recognition and recommendations |
| `TAVILY_API_KEY`, `FOOD_SEARCH_DEPTH` | Server | Brand and packaged-food web search |
| `FOOD_ROUTER`, `TYPESAFE_MODEL`, `TYPESAFE_API_KEY` | Server | Recognition routing mode (Jev by default) and the Jev classifier |
| `EXA_API_KEY` | Server | Nutrition agent web search |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Supabase project; leave empty to run in local mode |
| `SUPABASE_SECRET_KEY` | Server | Service-role key used by API routes; bypasses RLS |

Without Supabase variables the app runs in local mode and stores data in `localStorage`. Without an LLM key, recognition returns a configuration error but local matches still work.

## Run locally

```sh
npm run dev          # op run --env-file=.env -- next dev
npm run typecheck
npm test
npm run build
```

`npm run dev` talks to the real Supabase project. Read [production data safety](../AGENTS.md#production-data-safety) before signing in or running the smoke suites (`npm run auth:smoke`, `npm run api:smoke` with the dev server running).

## Nutrition database

The full per-100g database (`data/nutrition-100g.json`, `.csv`, `nutrition-recipes.json`) is never committed. Without it the app uses `data/nutrition-100g.example.json`. `python3 scripts/nutrition/prepare.py` downloads the pinned USDA archives, verifies their checksums and rebuilds it; Vercel runs this before every build (`vercel.json`). See `data/README.md`.

## Verify your setup

- [ ] `npm install` succeeds.
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass.
- [ ] `npm run dev` starts and `op run` resolves every reference (no `op://` value reaches the app).
- [ ] The landing page and `/workspace` render at desktop and 375px width.

## Production boundary

Local development and Vercel use the same Supabase project. Deploying, changing Vercel environment variables or applying migrations requires separate explicit authorisation.

## Open-source release checklist

The repository is public. Before pushing, and before any release:

1. `git status --short` shows no unexpected files.
2. `git ls-files` contains no `.env` other than `.env.example`, no full nutrition database, no `HANDOFF.md`, and nothing under `.claude/`, `.trae/`, `.vercel/` or `output/`.
3. `git check-ignore -v .env .env.local HANDOFF.md data/nutrition-100g.json .claude/settings.local.json` reports a rule for every path.
4. The history contains no secrets. Each pattern below must print nothing:

   ```sh
   git log --all -p -G'sk-[A-Za-z0-9]{20,}' --format=%h
   git log --all -p -G'sb_secret_|sb_publishable_' --format=%h
   git log --all -p -G'eyJ[A-Za-z0-9_-]{20,}\.' --format=%h
   git log --all -p -G'tvly-[A-Za-z0-9]{10,}' --format=%h
   git log --all -p -G'BEGIN [A-Z ]*PRIVATE KEY' --format=%h
   ```

5. Tracked files contain no account identifiers, vault names or personal data: `git grep -nE 'op://[A-Za-z]' -- . ':!*.md'` shows only placeholder references.

If a secret was ever committed, rotate it first; rewriting history does not make a published secret safe.
