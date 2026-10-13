# Testing

Read this guide when writing, changing or deleting tests.

## Purpose

A test earns its place by catching a plausible defect that the compiler or existing coverage would miss. Test observable behaviour at a public boundary so internal refactoring does not require rewriting assertions. Before adding a test, identify the consequential failure mode and its expected regression value.

## Test layers and ownership

| Behaviour | Test layer | Where |
| --- | --- | --- |
| Pure domain rules: targets, score, routing, brand and local matching, feedback progress | Unit test against the exported function | `tests/*.test.mjs` |
| Recognition HTTP handler with external services stubbed | Handler test: the real `food-ai` module graph with stubbed LLM, search, Jev and persistence | `tests/jev-router.test.mjs` |
| Streaming protocol and client parsing | Contract test | `tests/recognition-stream.test.mjs` |
| Database functions, RLS, day lifecycle, idempotency | SQL scenario, rolled back | `supabase/tests/*.sql` |
| API routes against the real backend, access isolation, concurrency | Smoke suite with throwaway users | `scripts/dev/api-smoke.mjs`, `scripts/dev/auth-smoke.mjs` |
| UI interaction and layout | Manual browser check, including 375px width | — |

## Running tests

- `npm test` runs Node's built-in runner over `tests/*.test.mjs`. Node 22.6+ strips TypeScript types, so tests can `import` a `.ts` module directly when that module has no value imports of other TypeScript modules.
- Modules with `@/` or extensionless relative imports are loaded through `tests/helpers/load-ts.mjs`: `lib('<path under src>')` loads one module and its imports; `loadTsGraph(file, { stubs, globals })` loads a module graph inside one VM context, replacing the listed import specifiers with stubs and providing globals such as `process.env` and `fetch`.
- SQL scenarios run as the `postgres` role in the Supabase SQL editor or through MCP `execute_sql`. Each runs inside one `DO` block and ends with an exception, so nothing is committed; success is reported as `ERROR: ALL_PASSED: ...`. Running them against the production project still requires the user's authorisation.
- The smoke suites create throwaway users marked `is_test`, delete them at the end and need a running dev server (`api:smoke`). They write to production; see [AGENTS.md](../AGENTS.md#production-data-safety). After a run, confirm with a read-only count that no `is_test` profiles remain.

## Boundaries to fake

Fake only external or nondeterministic boundaries: LLM providers, web search, the Jev router, email, the clock and identifiers when assertions require them. Do not fake the database inside backend tests; use the SQL scenarios or the smoke suites.

Access-isolation checks include a second user's records and verify they remain invisible and immutable. After rejected mutations, verify that stored state is unchanged. Assert stable error codes; a bare failure status does not establish the reason for rejection.

## Unit tests and exclusions

Use representative inputs and counterexamples that challenge assumptions, including ambiguous Chinese descriptions, brand names inside ordinary words, missing nutrients and explicit weights. Prefer extending an existing meaningful test over introducing another harness. Parameterise materially different cases, not repetitions of the same behaviour.

Do not add tests that repeat labels, constants, configuration, prompts, asset paths, trivial delegation, TypeScript guarantees or mock choreography. Straightforward copy and styling changes use direct output inspection.

When a scenario covers the behaviour of a lower-level test, remove the redundant test. Delete tests for removed code. No coverage percentage is configured; obligations follow concrete risk and regression value.
