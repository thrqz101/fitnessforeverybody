# Nutrition per-100g database

This folder holds the local "per 100g -> nutrients" food database used by the
`/api/nutrition-agent` function-calling route.

## Files

- `nutrition-100g.example.json` — committed. A tiny representative subset so the
  repo runs out of the box in CI / fresh clones.
- `nutrition-100g.json` — **local only, gitignored** (see `.gitignore`). This is
  the real/full database. It is never pushed to GitHub.

## Why the full DB is not on GitHub

The loader in `lib/nutrition-db.ts` reads `data/nutrition-100g.json` from disk at
runtime and falls back to the committed example when the local file is missing.
This keeps the full dataset private while still letting the running app answer
from the local database.

## How the agent "shows" it consulted the local DB

Every tool execution returns a `source` field (`local_db` / `exa_search` /
`llm_fallback`). The agent records these in `provenance` and includes a
`dbMeta` (version / source / count) in the final response, so consumers can
render a note like "已查询本地食品库（共 N 条）".

## Values

Values are reference/approximate. For production, replace `nutrition-100g.json`
with an authoritative source (e.g. USDA FoodData Central, China Food Composition
Tables) while keeping the same schema.

## Schema

```json
{
  "version": "1.0.0",
  "source": "curated_reference",
  "unit": "per_100g",
  "note": "...",
  "foods": [
    {
      "name": "米饭（熟）",
      "nameEn": "Cooked white rice",
      "category": "staple",
      "aliases": ["米饭", "rice"],
      "per100g": { "protein": 2.7, "carbs": 28.2, "fat": 0.3, "calories": 130, "fiber": 0.4 }
    }
  ]
}
```
