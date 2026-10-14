# Next-meal Recommendations

Read this guide before changing `src/features/recommendation` or `POST /api/recommend-ai`.

## Candidate pool

The pool is built in the browser from three sources and de-duplicated by brand and title (`domain/ranking.ts` `uniqueRecommendations`):

1. preset recommendations in `domain/preset-recommendations.ts`, which include the fixed-serving catalogue (`shared/catalog/food-catalog.ts`) and protein-powder combinations;
2. AI candidates the user requested with the “AI” action, kept for the session (at most 30);
3. for the shuffle feature, extra portion variants generated from catalogue items (`domain/shuffle.ts`).

Protein powder is modelled as one scoop of about 25 g protein inside fixed combinations; it is not a separate calculation.

## Ranking

When today's average completion across protein, carbs, fat and fiber reaches 80% (`shouldLightOnly`), only light candidates (top-ups, snacks, protein) remain. Candidates are ranked by `rankRecommendation`, which builds on `recommendationCoverage` in `shared/domain/recommendation-fit.ts`:

- coverage: how much of each remaining gap the candidate fills, capped at 100% per nutrient;
- overage penalty: amounts more than 125% of a gap reduce the score;
- fit bonus by category, depending on whether the remaining gap is a small top-up;
- diet-day and goal adjustments from the user's profile and today's settings;
- meals are preferred until the light-only threshold is reached, and penalised after it.

Region, meal-slot and style filters (`domain/filters.ts`) are applied after ranking. The list shows 6 items and grows on demand.

## AI candidates

`POST /api/recommend-ai` requires a signed-in session whenever Supabase is configured (401 `unauthenticated` otherwise; the client shows its generic failure notice and keeps the local pool). It receives the profile, day settings, gaps, targets, totals, main-meal count, the light-only flag, the desired count (30) and up to 50 existing options to avoid duplicates. `domain/ai-recommendations.ts` builds the prompt from the food catalogue summary and normalises the answer: categories are restricted to `meal`, `topup`, `protein` and `snack`, macros are rounded and non-negative, and light-only requests drop meals and anything above 560 kcal. Failures leave the local pool in place and show a notice; the request is never retried automatically.

## Shuffle

The shuffle picks a winner with stratified sampling across style buckets and avoids the 18 most recent winners (`pickStratifiedShuffleWinner`). It uses only candidates that pass the current filters and the light-only rule. The flash card traps focus and restores it on close.

## Choosing a recommendation

Choosing a candidate converts it to a `FoodLogItem` (`recommendationToFood`) with `source: "recommendation"` and adds it as a draft; if a meaningful gap remains, the app offers a top-up. Saving the draft to the calendar creates and confirms it in one call (`POST /api/entries` with `confirm: true`) in cloud mode.
