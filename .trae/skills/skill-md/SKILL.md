---
name: skill.md
description: "只针对于 **Fitness for Everybody** 这个项目的 skill 合集。"
---

# Claude Code Project Rules: Fitness for Everybody

This project is a vibe-coded MVP for **Fitness for Everybody**, based on `Fitness_for_Everybody_PRD.md`.

## Product Direction

Build a small, usable nutrition-tracking product for people who want to gain muscle, lose fat, lose weight, or eat healthier without weighing food or manually calculating macros.

The core promise:

1. User sets a profile and goal.
2. User records food by photo upload.
3. The app estimates nutrition and adds it to today's totals.
4. The app shows remaining nutrition gaps.
5. The app recommends the next meal, including protein powder options.
6. The app can randomly choose a meal with a "shake" style decision feature.

## MVP Scope

Prioritize a local, clickable MVP before real integrations.

Phase 1 should include:

- Onboarding for height, weight, sex, age, goal, target weight, and training/rest day state.
- BMR estimate using Mifflin-St Jeor.
- Daily nutrition target calculation.
- Dashboard with protein, carbs, fat, calories, and fiber progress.
- Photo upload UI that supports multiple images.
- Mock food recognition results with editable portion and nutrition values.
- Daily food log accumulation.
- Recommendation page with meal options and protein powder options.
- "Shake / decide for me" random recommendation.
- Simple profile editing.

Do not implement in the MVP unless explicitly asked:

- Real Claude Vision API calls.
- Real Nutritionix / USDA calls.
- Supabase authentication or persistence.
- Payment, community, social features.
- Precise oil/salt/sugar calculations.
- Exercise calorie tracking.

Use mock data and local state or local storage first. Keep the product easy to demo.

## Recommended Stack

Use the PRD's intended stack when creating the app:

- Next.js with App Router.
- React components.
- Tailwind CSS.
- TypeScript when practical.
- Local mock data in `lib/` for foods, recommendations, and nutrition formulas.

Only add backend/API routes when they make the MVP simpler or prepare a clear future integration point.

## UX Principles

This is not a medical dashboard. It should feel friendly, useful, and light.

- The first screen should be the actual product experience, not a generic marketing landing page.
- Make flows fast: users should understand what to do in seconds.
- Prioritize dashboard, upload, food confirmation, and recommendation loops.
- Avoid guilt-heavy language. Use supportive copy like "try this next" and "close enough is useful."
- Show nutrition gaps clearly with progress bars, numbers, and short labels.
- Recommendations must be normal foods: rice bowls, noodles, burgers, hotpot, convenience store meals, snacks, and protein powder supplements.
- Keep "shake" fun but still functional.

## Frontend Design Rules

Build an app-like interface, not a decorative landing page.

- Use a clear visual hierarchy and dense but readable dashboard layout.
- Use icons in buttons when available.
- Use stable dimensions for progress rows, cards, upload tiles, and recommendation cards.
- Do not use oversized hero sections for the product app.
- Avoid generic purple gradients, bland template cards, and one-note palettes.
- Avoid nested cards.
- Ensure text never overflows buttons or compact panels on mobile.
- Design mobile-first, then make desktop feel richer.
- Keep cards at 8px border radius or less unless the local design system says otherwise.

## Engineering Rules

- Read the PRD before making broad product changes.
- Keep implementation scoped to the current task.
- Prefer existing project patterns once the codebase exists.
- Keep nutrition formulas in a small reusable module.
- Keep mock nutrition and recommendation data structured, not scattered through components.
- Use components for repeated UI: progress rows, macro cards, food log items, recommendation cards, onboarding steps.
- Do not introduce real external services without explicit approval and environment variables.
- Do not store secrets in code.

## Nutrition Logic

Use simple estimates first:

- BMR:
  - Male: `10 * weightKg + 6.25 * heightCm - 5 * age + 5`
  - Female: `10 * weightKg + 6.25 * heightCm - 5 * age - 161`
- Protein target should depend on goal and training day.
- Training day can increase calories and carbs.
- Rest day should reduce extra calorie surplus.
- Protein powder can be modeled as 1 scoop = about 25g protein.

Keep formulas transparent and easy to adjust.

## API Integration Boundaries

Future integrations should be isolated behind adapter-like functions:

- Vision recognition adapter.
- Nutrition database adapter.
- User persistence adapter.

For MVP, these adapters can return mock data. The UI should not depend directly on external API response shapes.

## Accessibility

- Inputs need labels.
- Buttons need clear accessible names.
- Uploaded images need useful alt text or hidden decorative treatment.
- Progress information should have visible numbers, not only color.
- Keyboard users should be able to complete onboarding and choose recommendations.

## Verification

Before saying work is complete:

- Run the available lint/typecheck/build command if the project has one.
- Start the local dev server for frontend work when practical.
- Check mobile-sized layout mentally or with browser tooling if available.
- Report what was changed, what was verified, and what remains mocked.

## Working Style

Favor momentum and a complete first loop over perfect infrastructure. The best first version is one where the user can open the app, set a goal, add mock food from photos, see nutrition progress, and get a meal recommendation.