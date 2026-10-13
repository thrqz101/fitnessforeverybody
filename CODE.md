# Code Conventions

This guide owns how code is written. [ARCHITECTURE.md](ARCHITECTURE.md) owns where code lives and which layers may import each other.

## Files and naming

- React components: `PascalCase.tsx`, one exported component per file plus its small private helpers.
- Hooks: `use-*.ts` (for example `use-fitness-state.ts`); everything else: `kebab-case.ts`.
- Name a module after what it owns (`local-match.ts`, `ranking.ts`), not after a layer (`utils.ts`, `helpers.ts`).
- Client modules that use React state, effects or browser APIs start with `"use client";` as the first statement.
- Keep a file focused enough to read in one sitting; around 300 lines is the point to look for a seam. Pure data tables such as `shared/catalog/food-catalog.ts` are exempt.
- Import application code through the `@/` alias (`@/features/...`, `@/shared/...`). Use relative imports only for siblings in the same folder and for files outside `src/`, such as JSON in `data/`.
- Modules imported directly by Node tests (see [testing](docs/testing.md)) may only import other TypeScript modules as `import type`; their value imports must be JSON or Node built-ins.

## Feature modules

| Folder | Put here | Do not put here |
| --- | --- | --- |
| `domain/` | Pure rules, prompts, parsing and normalisation, static option tables, feature types | `fetch`, Supabase clients, React, `NextResponse` |
| `server/` | LLM and web-search clients, Supabase calls, pipelines that orchestrate them | JSX, browser APIs |
| `ui/` | Components and client hooks | Business rules that could be pure functions |
| `state/` | Client state hooks shared by several components of the feature | Rendering |

Code used by more than one feature moves to `shared/` only when a second real consumer exists.

## API route handlers

Route handlers follow one shape:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiUser();              // shared/supabase/api-auth
  if (auth instanceof Response) return auth;
  const body = await readJson(request);             // shared/api/route-helpers
  if (!isValid(body)) return badRequest();
  try {
    const result = await auth.admin.rpc("...", { p_user: auth.user.id, ... });
    if (result.error) throw new CloudError(result.error);
    return mutationResponse(result.data);
  } catch (error) {
    return failure(error);                          // stable { ok: false, code } responses
  }
}
```

The user id always comes from the session, never from the request body. Error responses carry a stable `code`, never a raw database or provider message; see [errors](docs/errors.md).

## TypeScript

- Avoid `any`. Use inference, explicit types, generic constraints, or `unknown` with narrowing. Keep an unavoidable `as any` local and explain non-obvious interop.
- Define types beside their owner. `shared/domain/types.ts` holds only the domain model shared across features (`MacroTotals`, `UserProfile`, `DayState`, `FoodLogItem`, `Recommendation`).
- Import a type from its owning module. Do not create bare rename aliases or re-export a type under a new name; an alias must add meaning, such as narrowing or composition.
- Prefer `Array<T>`, `??` for nullish fallback, and explicit invariant checks instead of optional chaining that hides required state.
- Use exhaustive `switch` statements for unions in new code. Assign the unhandled value to `never` in the default case and throw.
- Do not dispatch on union members with ternaries or catch-all `else` branches. Name every supported variant explicitly so adding a variant causes a type error at each affected dispatch site. Ordinary boolean choices, nullish defaults and intentional generic fallbacks remain appropriate.
- Keep registries, mappings, and discriminated unions strict using `as const`, `satisfies`, or `Record<Union, ...>`. Update affected consumers instead of loosening types.
- Export only what another module imports.

## Components

- Keep components thin: compute in `domain/` functions or `useMemo`, render in the component.
- Extract a sub-component when a block has its own state or its own dialog (for example `MacroConfirmDialog`, `BodyFatGuideDialog`), not to shorten a file by moving markup around.
- Every input has a label, every icon-only button has an `aria-label`, and progress values are shown as numbers, not only colour. See [ui](docs/ui.md).
- User-facing text is written in Chinese in source and translated through `t()` or `useText()`; see [i18n](docs/i18n.md).

## Comments

Write comments for the reason behind a rule, an invariant or a non-obvious constraint (for example why a failed save must never look like success). Do not narrate what the next line does. Tailwind scans source text, so avoid writing utility-class words such as `inline` or `hidden` in prose comments of files under `src/`.

## Tests

Follow [testing](docs/testing.md). Add a test for a calculation, a data-isolation rule or a lifecycle rule; do not add tests that restate constants or copy.
