# Fitness for Everybody — Project Conventions

This is a **Next.js App Router** nutrition-tracking web app. Users describe what
they ate in natural language; the built-in nutrition agent splits it into
recordable food items, estimates per-100g nutrition, compares daily totals
against a personalized macro target, and recommends the next meal.

## Product Direction

Help people gain muscle, lose fat, lose weight, or eat healthier without weighing
food or manually calculating macros.

1. User sets a profile and goal.
2. User records food by typing what they ate.
3. The agent estimates nutrition and adds it to today's totals.
4. The app shows remaining nutrition gaps.
5. The app recommends the next meal, including protein powder options.

## Architecture

- **Next.js App Router + Server Components**: `app/api` is the HTTP boundary,
  `lib` holds domain logic, the agent, tools, conversions, and i18n, and
  `components` renders UI only.
- **Agent**: `lib/agent/run-agent.ts` runs a function-calling loop over three
  tools — the local per-100g food DB, Exa web search, and LLM estimation.
- **Backend**: an independent EdgeSpark (Cloudflare D1 + Drizzle) module lives in
  `server/` and is excluded from the Next build via `tsconfig`.
- **Types**: `lib/types.ts` centralizes domain types for cross-layer reuse.

## Engineering Rules

- Keep implementation scoped to the current task.
- Prefer existing project patterns once the codebase exists.
- Keep nutrition formulas in a small reusable module.
- Use components for repeated UI: progress rows, macro cards, food log items,
  recommendation cards, onboarding steps.
- Do not introduce real external services without explicit approval and
  environment variables.
- Do not store secrets in code.

## Nutrition Logic

- BMR (Mifflin-St Jeor):
  - Male: `10 * weightKg + 6.25 * heightCm - 5 * age + 5`
  - Female: `10 * weightKg + 6.25 * heightCm - 5 * age - 161`
- Protein target depends on goal and training day.
- Training day increases calories and carbs; rest day reduces surplus.
- Protein powder is modeled as 1 scoop ~= 25g protein.

## API Integration Boundaries

External integrations are isolated behind adapter-like functions so the UI does
not depend directly on external API response shapes.

- Nutrition database adapter: loads the local per-100g DB and fuzzy-matches input.
- Web search adapter: retrieves brand / store / packaged-food nutrition sources.
- Persistence adapter: writes user entries through the backend module.

## Accessibility

- Inputs need labels.
- Buttons need clear accessible names.
- Progress information should have visible numbers, not only color.
- Keyboard users should be able to complete onboarding and choose recommendations.

## Verification

- Run the available lint/typecheck/build command if the project has one.
- Start the local dev server for frontend work when practical.
- Check mobile-sized layout mentally or with browser tooling if available.
- Report what was changed and what was verified.
