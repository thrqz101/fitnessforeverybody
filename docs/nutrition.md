# Nutrition Targets

Read this guide before changing `src/shared/domain/nutrition.ts`, `score.ts` or the settings form in `features/profile`.

## Inputs

The profile (`UserProfile`) holds height, weight, sex, age, BMR, goal (`muscle`, `fat_loss`, `weight_loss`, `health`), target weight, optional body fat values, training structure, eating pattern, and optional custom macro multipliers and fiber grams. The day (`DayState`) holds training day, trained body part, intensity, sets, duration and diet-day status (`normal`, `high_carb`, `low_carb`, `high_protein`, `free`).

## BMR

When the user does not enter a BMR, Mifflin-St Jeor estimates it:

- male: `10 × weightKg + 6.25 × heightCm − 5 × age + 5`;
- female: `10 × weightKg + 6.25 × heightCm − 5 × age − 161`.

## System targets

`calculateSystemTargets` derives protein, carbs, fat, calories and fiber per goal from body weight and BMR. Training days raise protein, carbs and calories; intensity and training load (sets and duration) add calories; rest days remove the surplus. Diet-day status then shifts carbs, fat and protein (`applyDietAdjustments`). The constants live in code and are the specification; change them there, with a test in `tests/nutrition-targets.test.mjs` when the behaviour changes.

## Custom multipliers

The settings form shows the system targets as recommended multipliers (grams per kg of body weight) and lets the user adjust protein, carbs and fat within `macroMultiplierBounds`, and fiber within `fiberGramBounds`. Saved multipliers are the user's targets: grams are `weightKg × multiplier`, rounded, and calories are always computed from the rounded grams as `protein × 4 + carbs × 4 + fat × 9`. Fiber is set separately and is not counted in calories. The system calorie budget remains a reference only.

## Daily score

`shared/domain/score.ts` weights protein 25, calories 25, carbs 20, fat 15 and fiber 15. Each nutrient contributes `min(actual / target, 1)`; overshoot adds nothing. The displayed percentage is rounded down to one decimal. The database function `public.weighted_score` implements the same weights and decides whether a day is effective (at least two confirmed recognition flows and a score of at least 0.5); keep both in sync.
