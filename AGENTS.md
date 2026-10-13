# Agent Instructions

Fitness for Everybody is a Next.js App Router nutrition-tracking web app backed by Supabase. Users describe what they ate in natural language; the recognition pipeline splits it into food entries, estimates nutrition, compares daily totals with a personalised macro target and recommends the next meal. Read [ARCHITECTURE.md](ARCHITECTURE.md) for ownership and request flow and [CODE.md](CODE.md) for coding conventions.

`CLAUDE.md` is a symbolic link to this file. Edit `AGENTS.md` only.

## Product Direction

Help people gain muscle, lose fat, lose weight or eat healthier without weighing food or manually calculating macros.

1. The user sets a profile and goal.
2. The user records food by typing what they ate.
3. The app estimates nutrition and adds it to today's totals.
4. The app shows remaining nutrition gaps.
5. The app recommends the next meal, including protein powder options.

## Initiative and Follow-through

- Treat requests such as “can you” and “help me” as instructions to complete the work and required verification. Resolve routine choices using conversation context and repository patterns; state material assumptions.
- Ask when specifications and user decisions leave consequential behaviour unresolved, including product, data-retention or deployment decisions. Continue independent, authorised work while waiting.
- Prepare a concrete, reviewable result before requesting approval. Existing authorisation remains valid unless the target, scope, or effect changes.
- Follow the explicit command, production-data, schema, and external-write restrictions below. General task intent does not waive them; do not invent additional approval requirements.
- Incorporate follow-up corrections and requirements into the active task. Answer side questions without abandoning the original objective unless the user cancels or replaces it.

## Instruction and Skill Handling

- Apply skills only when relevant to the requested work. Explicit user instructions take precedence over skill guidelines, subject to system and developer instructions.
- Before treating an instruction as a blocker, check its scope, exceptions, and existing authorisation. If it requires pausing or leaving work unfinished, link to the exact file, quote the rule, and explain its application. Distinguish requirements from your interpretation of guidance.

## Working Principles

- Read the relevant code before changing it. Prefer established repository patterns over generic best practices.
- Before extending a workflow, locate its owning feature module and documentation. Put new policy choices at the existing owner.
- Keep changes within the requested feature. Ask before refactoring unrelated code or introducing a new architectural pattern.
- Choose the simplest complete implementation with clear ownership and maintainable boundaries. Avoid speculative configuration, extension points, indirection, and exports without a current production consumer. Use temporary or transitional solutions only when explicitly requested.
- Build working end-to-end slices where the task permits. Extend a working path without replacing it with partially integrated architecture.
- For cross-cutting changes, provide a short review map identifying owners, key invariants, dependency order and relevant tests. Use it to plan reviewable implementation checkpoints; commit only when authorised.
- Before adding common functionality or a dependency, inspect existing dependencies, modules, documentation, and types. Prefer an established repository solution when it fits. Ask before adding any dependency.
- Code introduced during the current task has no compatibility obligation until delivery. Rewrite it and remove superseded paths instead of adding adapters; this does not waive compatibility for pre-existing behaviour, persisted data, deployed clients, external consumers, or staged rollouts.
- Delete clearly unused code when it is in scope for the files being changed.
- Preserve supplied text, quotations, schemas, APIs, and product terminology. User-facing copy is bilingual; see [i18n](docs/i18n.md).
- Write documentation as standalone current-state specifications of behaviour, ownership, and boundaries. Link to specialised guides instead of duplicating their rules; follow [documentation](docs/documentation.md) for prose conventions.
- Add documentation only when it preserves a durable contract, non-obvious invariant, operational procedure, or decision that future work needs and cannot readily recover from the owning code. Do not add prose merely to record that a change was made.
- Before a cross-cutting workflow or data-model change, establish the current-state design in the owning document. Define lifecycle states, canonical storage, invariants, correction boundaries, affected consumers, and unresolved product decisions before coding.
- Keep generic owners free of feature-specific branches. Put specialisation in the owning feature module.

## Commands and Safety

- Use `npm` for repository commands. Commands that need secrets run through 1Password: the `dev`, `build:local`, `start`, `auth:smoke` and `api:smoke` scripts already wrap `op run --env-file=.env`. Set `OP_ACCOUNT` in your shell when several 1Password accounts are signed in; see [setup](docs/setup.md).
- Checks: `npm run typecheck`, `npm test` (Node's built-in runner over `tests/*.test.mjs`) and `npm run build`. `npm run auth:smoke` and `npm run api:smoke` exercise the real Supabase project and need a running dev server for the API suite; they are production writes, see below.
- Dev servers may be started as needed; check for an existing process first. Do not run deploys, migrations, or the nutrition data scripts unless the user explicitly asks.
- Read-only Git commands are always allowed without additional permission, including status, diff, log, show, and blame. Git operations that change local or remote state require explicit user authorisation. Do not commit, push, discard, or revert work implicitly, and never remove work you did not author.
- For authorised commits and PRs follow [git](docs/git.md).
- Rewrite history only when the user explicitly authorises the exact branch and operation. Preserve recoverable history before a destructive rewrite.

### Secrets and open-source safety

This repository is public. Anything local, personal or secret must never be committed.

1. Never write a real key into code, configuration or `.env`, not even temporarily.
2. `.env` holds only `op://<vault>/<item>/<field>` references; `.env.example` holds empty values and comments.
3. Code reads keys only from environment variables (`process.env.X`). Do not load reference-style `.env` files with dotenv.
4. Start and test commands always run as `op run --env-file=.env -- <cmd>`, as the `package.json` scripts do.
5. Never log, print or echo a key value or a full environment dump.
6. A new service needs its key in 1Password before a reference line is added to `.env`. If the key is missing, ask the user to add it; never invent one.
7. `NEXT_PUBLIC_*` variables are shipped to the browser and must only hold public values.
8. Local data (the full nutrition database, SQLite files, Supabase CLI state), private notes (`HANDOFF.md`) and tool state stay local. When a new kind of local file appears, add it to `.gitignore` and `.vercelignore` first.
9. Before committing, check `git status --short` for unexpected files. The release checklist in [setup](docs/setup.md#open-source-release-checklist) covers history scans.

### Production data safety

- Treat every production write as a separate, high-consequence operation. The Supabase project used by local development is the production project. Do not create, update, delete, migrate, backfill, seed, reprocess, retry, or otherwise mutate production data unless the user explicitly authorises that exact production operation.
- Production authorisation must be direct and unambiguous in the current conversation. A request to change code, prepare wording, discuss a future change, say that something “will” or “has” happened, or instructions that the user will perform an operation themselves do not authorise the agent to perform it.
- Before requesting authorisation, state the exact production target, the current value when known, the proposed new value, and the expected effect. Wait for the user's affirmative instruction before executing the write.
- Tool or sandbox approval only permits command execution; it does not establish user intent or production-write authorisation. Never use an approval prompt to manufacture or substitute for missing substantive authorisation.
- If an unauthorised or mistaken production write occurs, stop and report the exact change. Do not attempt to revert, compensate, or make a second production write without explicit authorisation for that remediation. A revert is itself a production write.
- Prefer read-only production inspection when debugging. Keep read queries bounded and return only the fields needed for the investigation.
- After an authorised production write, verify the resulting state with a read-only check and report exactly what changed. Do not bundle additional cleanup, normalisation, or adjacent fixes into the authorised operation.
- Applied files in `supabase/migrations` are immutable; schema changes go in a new migration and require the user's explicit approval for that exact data-model change.

## Read Documentation Only When Relevant

Search the repository with `rg` first. Then read only the documents that apply to the code being changed. Do not preload unrelated guides.

- Directory ownership, layering and request flow: [ARCHITECTURE.md](ARCHITECTURE.md).
- TypeScript, naming, module and component conventions: [CODE.md](CODE.md).
- Food recognition pipeline, routing, local and brand catalogues, LLM providers: [docs/recognition.md](docs/recognition.md).
- Next-meal recommendations: [docs/recommendation.md](docs/recommendation.md).
- BMR, macro targets and day adjustments: [docs/nutrition.md](docs/nutrition.md).
- Tables, RLS, database functions, migrations and SQL tests: [docs/supabase.md](docs/supabase.md).
- Copy and translations: [docs/i18n.md](docs/i18n.md).
- Dates, the Beijing calendar day and time: [docs/date.md](docs/date.md).
- Errors and retry behaviour: [docs/errors.md](docs/errors.md).
- Interface, accessibility and copy conventions: [docs/ui.md](docs/ui.md); Tailwind, mobile and styling: [docs/css.md](docs/css.md).
- Writing, changing or deleting tests: [docs/testing.md](docs/testing.md).
- Local setup, environment variables and the release checklist: [docs/setup.md](docs/setup.md).
- Markdown or domain documentation: [docs/documentation.md](docs/documentation.md).
- Authorised commits, pushes and PRs: [docs/git.md](docs/git.md).

Use Context7 for unfamiliar libraries, frameworks, SDKs or CLIs after checking repository patterns and docs. If no pattern fits, use primary documentation, state that the change introduces a new pattern, and document it when it should be reused.

## Implementation and Verification

- Keep React components and route handlers thin when branchy domain logic can be a pure, typed function in a feature's `domain/`.
- Make important logic deterministic and testable. Inject clocks, IDs, storage, network, or service clients when hidden environment coupling would make meaningful tests difficult.
- Add tests only when their expected regression value outweighs their maintenance cost. Before writing one, identify a concrete, consequential failure mode that the compiler and existing coverage would miss; follow [testing](docs/testing.md). A changed file or new branch is not by itself a reason to add a test. Prefer extending an existing behavioural scenario over adding a new test suite or harness.
- Test backend behaviour through the API routes or the SQL scenarios in `supabase/tests`, with real users and owned records. Include a second user's records when checking access isolation. Fake only external boundaries such as LLM providers, web search, email and the clock.
- When a pure domain rule warrants testing, use representative source inputs and counterexamples that challenge implementation assumptions, including ambiguous wording and missing metadata.
- Omit tests that mirror literals, configuration, prompts, labels, trivial delegations, TypeScript guarantees, or mock choreography. When a scenario covers a behaviour, delete the lower-level tests it replaces.
- For simple copy, template wording, styling, or straightforward substitutions, default to existing tests, necessary fixture updates and direct output inspection. Add focused coverage when the change carries a material risk, such as incorrect calculations, lost data, access violations, lifecycle errors, or a substantive domain rule; keep the test proportional to that risk.
- Run `npm run typecheck` and the relevant tests at the end of routine code changes. Run `npm run build` when routing, configuration or bundling may be affected. For frontend work, start the dev server and check the affected flow, including a mobile-width layout.
- Once the relevant checks pass, broaden or repeat verification only when subsequent changes, failures, or unresolved concerns justify it. For documentation-only changes, check the affected content, links, and formatting; code tests and typechecks are unnecessary unless executable behaviour changes.

## Delegation

- When subagents are authorised and available, delegate bounded, independent work that improves speed or quality. Define scope, constraints, and expected results; avoid overlapping edits and review and integrate their work. Keep small or tightly coupled tasks local.

## Scope and Handoff

- Lead with the outcome in concise, plain technical language. Use lists or tables when helpful; avoid stock phrases, invented jargon, unnecessary contrasts, and repeated summaries.
- During sustained work, report meaningful findings, decisions, and blockers. In the handoff, explain what changed, why, verification results or checks that could not run, and material limitations. Scale detail to the task.
- Propose follow-ups only for concrete bugs, risks, missing coverage or tooling, repeated manual work, or worthwhile technical debt. Include the affected path, trigger, impact, and completion condition.
- Creating or modifying an issue is an external write and requires user authorisation. Otherwise, propose the follow-up in the handoff.
