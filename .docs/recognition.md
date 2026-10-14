# Food Recognition

Read this guide before changing `src/features/recognition` or `POST /api/food-ai`.

## Contract

`POST /api/food-ai` takes form data `description`, `lang` (`zh` | `en`), optionally a typed-ahead `routeHint` with `routeHintConfidence`, and, in cloud mode, a `requestId` UUID. It returns `{ ok, isFoodRelated, message, foods: FoodLogItem[], provider, routing, diagnostics }`. `GET /api/food-ai` is a provider warm-up that returns `{ ok: true }` or a 503 when no provider is configured.

With `Accept: application/x-ndjson` the same POST streams progress. Each line is `{ type: "progress", step: { id, status, labelZh, labelEn } }`, followed by exactly one `{ type: "result", status, result }`. The logical HTTP status is carried in the result event. Callers without that header receive the plain JSON response and status. Steps report only work that actually happened (input, brand, local, route, search, organize, estimate, repair, result); no model reasoning is streamed.

`recognition/ui/recognition-client.ts` handles chunked UTF-8, partial JSON lines, broken streams, timeouts and cancellation. A stream without a result event is a failure. Progress is not persisted.

## Typing-time routing

While the user types, `recognition/ui/use-route-preview.ts` waits 500 ms after the last keystroke and calls `POST /api/food-route` (`server/route-preview.ts`). The preview first applies the input checks of step 1 below; a vague description or more than 6 foods returns a `not_food` preview with the rejection `message`, without any network call, whatever the router. Otherwise it uses the same evidence as recognition (`server/routing-evidence.ts`): when a known brand or a complete local match makes the rules certain, or the router is not `jev`, it returns `null`; otherwise it asks Jev, and a `not_food` choice also carries the not-food `message`. On submit, a text without a preview yet (submitted within the 500 ms) starts one immediately, and recognition waits up to 2.5 s for it. A preview with a `message` is shown as an error notice and recognition does not start; any other preview is sent as `routeHint`; recognition accepts it only for a known route with at least Jev's 0.8 confidence and only where it would otherwise call Jev, and marks the result `routing.prefetched`. A failed, still pending (after 2.5 s) or invalid preview simply leaves the decision to the server. The preview endpoint requires a signed-in session whenever Supabase is configured.

## Pipeline

`server/recognize.ts` orchestrates these stages; every stage is timed into `diagnostics.timingsMs` and the `Server-Timing` header.

1. Input checks (`domain/explicit-items.ts`): a description with no concrete food gets a prompt to be specific; more than 6 explicit foods (`maxRecognizedFoodItems`) asks the user to split the input. These replies come before the cloud start, so a rejected input records nothing.
2. Cloud start (`server/cloud-recognition.ts`): verifies the session and registers the request id. A finished request replays its stored result; a request still running returns 409 `processing`; the same id with different text is refused.
3. Brand match (`domain/brand-catalog.ts`): the brand catalogue in `data/food-brands.json` is matched first. Brand evidence always takes precedence over generic food values.
4. Local match (`domain/local-match.ts`): without a brand, explicit weights resolve against the per-100g database (`shared/catalog/nutrition-db.ts`); otherwise fixed servings from `shared/catalog/food-catalog.ts` are used, unless the description has a nonstandard portion (half, large, several, grams).
5. Route decision: `local_exact`, `brand_search`, `ai_estimate` or `not_food`.
   - `FOOD_ROUTER=jev` or unset (default): a known brand goes straight to brand search and a complete local match straight to local, with no network call. Only the remaining, uncertain descriptions (unknown store names, mixed or non-food input) ask the TypeSafe Jev classifier (`domain/jev-router.ts`), with brand hints and local matches as evidence. Below 0.8 confidence, after 2 seconds, without a resolved `TYPESAFE_API_KEY`, or on any error it falls back to the rules router and records `routing.fallbackReason`; there is no extra LLM routing call.
   - `FOOD_ROUTER=rules` (no network): `domain/food-router.ts` picks brand search when a brand matched, local when local matches cover the whole description, otherwise estimate.
   - `FOOD_ROUTER=llm`: `server/llm-steps.ts` `classifyFoodRoute`; this legacy mode also asks the model for `*Zh`/`*En` mirror fields.
   - `local_exact` is downgraded to `ai_estimate` whenever local coverage is incomplete.
6. Brand search (`server/tavily-search.ts`, `server/llm-steps.ts`): a focused Tavily query returns at most 3 sources with one snippet each; an LLM call extracts foods from those sources. Search or extraction failure falls through to estimation and records `routing.fallbackReason`.
7. Estimation (`domain/prompts.ts`, `server/llm-client.ts`): one LLM call with Chinese dining portion baselines; local matches are passed as fixed context and only the remaining foods are analysed. A malformed answer gets one repair call (`server/llm-steps.ts` `repairAiPayload`). If the provider fails, local matches are returned as a partial result when available.
8. Normalisation (`domain/ai-foods.ts`): foods not supported by the description are dropped, brands are filled from the catalogue, generic places such as “楼下面馆” or “公司食堂” are never stored as brands (`isGenericVenue`), macros are normalised, and local and AI foods are merged without duplicates. The prompt requires `calories ≈ protein×4 + carbs×4 + fat×9` within 25%.
9. Persistence (`server/persist.ts`): in cloud mode the foods are stored as draft entries before the response is sent. A failed save is reported as a failure, never as success.

## Search evidence

Only a brand search that returned sources and produced foods attaches `FoodLogItem.searchEvidence` (`domain/build-search-evidence.ts`). Local matches, direct estimates, brand-only matches and search fallbacks carry no sources. Source URLs come from real search results; official pages come from verified brand records, never from model output. Only credential-free HTTP(S) links are accepted (`shared/domain/search-evidence.ts`). Evidence is saved with the food. The recognition panel shows only the evidence of the latest recognition on the page; it appears once a recognition starts, stays open while it runs and collapses when it finishes.

## LLM providers

`AI_PROVIDER` selects `minimax` (default), `deepseek`, `ccswitch` or `dashscope`; each reads its own key, base URL and model from the environment (see `.env.example`). Requests use the OpenAI chat-completions shape, retry across known endpoint paths and have per-stage timeouts (routing 20 s, search extraction 25 s, estimation 35 s, repair 20 s, warm-up 12 s). Provider errors are mapped to user-facing copy; raw provider messages never reach the browser.

`features/recommendation/server/llm-client.ts` is a separate, simpler copy of the provider client used by recommendations: it has no timeout and moves to the next endpoint path only on 404 or 405. Merging the two changes recommendation timeout behaviour and needs its own decision.

## Catalogues

- `data/food-brands.json`: brand names, aliases, ambiguous names, official domains and verification sources. It contains no nutrition values. Pending brands do not participate in matching.
- `shared/catalog/food-catalog.ts`: fixed-serving combos and dishes used for local matches and recommendations.
- Per-100g database: `data/nutrition-100g.json` is built locally or on Vercel by `scripts/nutrition/prepare.py` from pinned, checksummed USDA FoodData Central archives and is never committed; without it the loader falls back to `data/nutrition-100g.example.json`. See `data/README.md` for sources and conventions.

## Nutrition agent

`POST /api/nutrition-agent` (`features/agent`) is a separate function-calling agent. It loops up to 5 rounds over three tools: the local per-100g database, Exa web search and an LLM estimate, and returns `provenance` and `dbMeta` for diagnostics. The web app does not call it.

## Tests

`tests/jev-router.test.mjs` drives the real handler graph with stubbed Jev, Tavily, LLM and persistence; `tests/brand-catalog.test.mjs`, `tests/nutrition-db.test.mjs` and `tests/recognition-stream.test.mjs` cover matching and streaming. Real recognition runs are covered by `npm run api:smoke`.
