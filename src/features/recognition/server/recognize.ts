import type { ProgressReporter } from "@/features/recognition/domain/events";
import { type Language, normalizeLanguage } from "@/shared/i18n/i18n-utils";
import { type RoutingMeta, classifyWithJev, effectiveFoodRoute, readRouteHint } from "@/features/recognition/domain/jev-router";
import { findLocalEvidence, jevRoutingContext, rulesAreCertain } from "@/features/recognition/server/routing-evidence";
import { type CloudRun, beginCloudRecognition } from "@/features/recognition/server/cloud-recognition";
import { persistRecognition } from "@/features/recognition/server/persist";
import { findFoodBrandMatches, isBrandOnlyDescription } from "@/features/recognition/domain/brand-catalog";
import { foodRouterMode, selectRuleFoodRoute } from "@/features/recognition/domain/food-router";
import { buildSearchEvidence, searchFoundBrandProduct } from "@/features/recognition/domain/build-search-evidence";
import { id, cleanAiFoodsForDescription, parseAiPayload, shouldRepairAiPayload } from "@/features/recognition/domain/ai-foods";
import type { TimingStage, SearchDiagnostics, AiRouteDecision, AiFood } from "@/features/recognition/domain/types";
import { buildEstimatePrompt, localized } from "@/features/recognition/domain/prompts";
import { isVagueFoodDescription, exceedsExplicitFoodItemLimit, vagueFoodMessage, buildTooManyFoodsResponse, isTooManyFoodDecision, buildTooManyFoodsResponseIfNeeded } from "@/features/recognition/domain/explicit-items";
import { getProviderConfig, buildChatCompletionBody, requestChatCompletion, mainAiTimeoutMs, buildAiServiceErrorResponse, extractAssistantContent } from "@/features/recognition/server/llm-client";
import { buildStrictLocalResponse, mergeStrictLocalAndAiFoods, buildExactLocalResult } from "@/features/recognition/domain/local-match";
import { classifyFoodRoute, extractAiPayloadFromSearch, repairAiPayload } from "@/features/recognition/server/llm-steps";
import { normalizeRouteDecision, buildFallbackRouteDecision, shouldUseBrandSearch, notFoodMessage } from "@/features/recognition/domain/route-decision";
import { searchNutritionWithTavily } from "@/features/recognition/server/tavily-search";

export async function recognizeFood(request: Request, report?: ProgressReporter, signal?: AbortSignal) {
  const progress = (id: string, status: "active" | "complete" | "warning" | "error", labelZh: string, labelEn: string) => {
    if (!signal?.aborted) report?.({ id, status, labelZh, labelEn });
  };
  let language: Language = "zh";
  let routing: RoutingMeta | undefined;
  let cloud: CloudRun | null = null;
  const requestStarted = Date.now();
  const timings: Record<TimingStage, number> = { brandMatch: 0, localLookup: 0, routing: 0, search: 0, searchLlm: 0, estimateLlm: 0, repairLlm: 0, normalize: 0 };
  let llmCalls = 0;
  const search: SearchDiagnostics = { depth: process.env.FOOD_SEARCH_DEPTH === "fast" ? "fast" : "basic", resultCount: 0, status: "not_used" };
  async function measure<T>(stage: TimingStage, operation: () => Promise<T>): Promise<T> {
    signal?.throwIfAborted();
    const started = Date.now();
    if (stage.endsWith("Llm")) llmCalls++;
    try { return await operation(); }
    finally { timings[stage] += Date.now() - started; }
  }
  function measureSync<T>(stage: TimingStage, operation: () => T): T {
    const started = Date.now();
    try { return operation(); }
    finally { timings[stage] += Date.now() - started; }
  }
  const respond = async (rawBody: Record<string, unknown>, rawInit?: ResponseInit) => {
    let body = rawBody;
    let init = rawInit;
    if (cloud) {
      // The result is only reported once it is stored; a failed save must never look like success.
      const persisted = await persistRecognition(cloud.admin, cloud.userId, cloud.requestId, rawBody, routing?.effectiveRoute ?? null, language);
      body = persisted.body;
      if (!persisted.ok) init = { status: persisted.status };
    }
    const successful = body.ok === true && body.isFoodRelated === true && Array.isArray(body.foods) && body.foods.length > 0;
    progress("result", successful ? "complete" : body.ok === false ? "error" : "warning",
      successful ? "识别完成，结果已准备好" : body.ok === false ? "识别暂未完成，请重试" : "需要补充具体的食物信息",
      successful ? "Recognition complete. Results are ready." : body.ok === false ? "Recognition could not finish. Please retry." : "Please provide more specific food information.");
    const total = Date.now() - requestStarted;
    const headers = new Headers(init?.headers);
    headers.set("Server-Timing", [...Object.entries(timings).map(([name, ms]) => `${name};dur=${ms}`), `total;dur=${total}`].join(", "));
    return Response.json({ ...body, ...(routing ? { routing } : {}), diagnostics: { timingsMs: { ...timings, total }, llmCalls, search } }, { ...init, headers });
  };

  const attachDiagnostics = async (response: Response) => respond(await response.json(), { status: response.status, headers: response.headers });
  const missingProviderResponse = () => respond({
    ok: false, needsConfig: true,
    message: localized(language, "AI 服务还没配置好。请检查 AI_PROVIDER、模型和服务配置。", "The AI service is not configured. Check the provider, model, and service configuration.")
  }, { status: 503 });

  try {
    const form = await request.formData();
    const description = String(form.get("description") ?? "").trim();
    language = normalizeLanguage(form.get("lang"));
    progress("input", "complete", "已收到食物描述", "Food description received");

    // Rule rejections answer before the recognition is recorded, so they cost no database write.
    if (isVagueFoodDescription(description)) {
      return respond({ ok: true, isFoodRelated: false, foods: [], message: vagueFoodMessage(language) });
    }

    if (exceedsExplicitFoodItemLimit(description)) {
      return attachDiagnostics(buildTooManyFoodsResponse(language));
    }

    const started = await beginCloudRecognition(form, description, language);
    if (started.mode === "reply") return started.response;
    if (started.mode === "run") cloud = started.run;

    const provider = getProviderConfig();

    const routerMode = foodRouterMode(process.env.FOOD_ROUTER);
    progress("brand", "active", "正在检查品牌信息…", "Checking brand information…");
    const brandMatches = measureSync("brandMatch", () => findFoodBrandMatches(description));
    progress("brand", "complete", brandMatches.length ? `已识别品牌：${brandMatches.map(b => b.brand).join("、")}` : "未匹配到品牌，继续检查食物",
      brandMatches.length ? `Brand identified: ${brandMatches.map(b => b.nameEn || b.brand).join(", ")}` : "No brand match. Checking the food next.");
    if (!brandMatches.length) progress("local", "active", "正在匹配食物和份量…", "Matching foods and portions…");
    const evidence = measureSync("localLookup", () => findLocalEvidence(description, brandMatches.length > 0, language));
    const { canUseFixedLocal, strictLocalMatches, hasOnlyStrictLocalMatches, analysisDescription } = evidence;
    if (!brandMatches.length) progress("local", "complete", strictLocalMatches.length ? `已匹配 ${strictLocalMatches.length} 项食物` : "将继续分析食物信息", strictLocalMatches.length ? `Matched ${strictLocalMatches.length} foods` : "Continuing food analysis");
    progress("route", "active", "正在选择识别方式…", "Choosing how to recognize this meal…");
    const routingStarted = Date.now();
    const routeHint = readRouteHint(form);
    const jev = routerMode !== "jev" || rulesAreCertain(brandMatches.length > 0, hasOnlyStrictLocalMatches) ? null
      // A route Jev already chose while the user was typing saves the classification round trip.
      : routeHint ? { ok: true as const, ...routeHint, durationMs: 0 }
      : await classifyWithJev(jevRoutingContext(description, evidence), { signal });
    let routeDecision: AiRouteDecision;
    if (jev?.ok) {
      const route = effectiveFoodRoute(jev.route, hasOnlyStrictLocalMatches);
      routeDecision = { route, isFoodRelated: route !== "not_food" };
      routing = { router: "jev", selectedRoute: jev.route, effectiveRoute: route,
        confidence: jev.confidence, durationMs: Date.now() - routingStarted, fallbackReason: null,
        ...(routeHint ? { prefetched: true } : {}) };
    } else if (routerMode === "llm") {
      if (!provider) return missingProviderResponse();
      llmCalls++;
      const routingResult = await classifyFoodRoute(provider, analysisDescription, strictLocalMatches, language, signal);
      routeDecision = normalizeRouteDecision(
        routingResult.ok ? routingResult.decision : buildFallbackRouteDecision(description, strictLocalMatches, false, language),
        description
      );
      const selectedRoute = routeDecision.route!;
      routeDecision.route = effectiveFoodRoute(selectedRoute, hasOnlyStrictLocalMatches);
      routing = { router: routingResult.ok ? "llm" : "rules", selectedRoute,
        effectiveRoute: routeDecision.route, durationMs: Date.now() - routingStarted, fallbackReason: null };
    } else {
      // Rules mode, or Jev was unavailable: decide instantly from the brand and local matches.
      const route = selectRuleFoodRoute({ description, hasBrand: brandMatches.length > 0,
        brandOnly: isBrandOnlyDescription(description, brandMatches), localCoverageComplete: hasOnlyStrictLocalMatches });
      routeDecision = { route, isFoodRelated: route !== "not_food" };
      routing = { router: "rules", selectedRoute: route, effectiveRoute: route,
        durationMs: Date.now() - routingStarted, fallbackReason: jev && !jev.ok ? jev.reason : null };
    }

    timings.routing = Date.now() - routingStarted;
    const routeLabels = {
      local_exact: ["已完成食物与份量匹配", "Foods and portions matched"],
      brand_search: ["将联网查找品牌资料", "Looking up public brand information"],
      ai_estimate: ["将按食物与份量分析营养", "Analyzing nutrition from the food and portion"],
      not_food: ["需要更具体的食物描述", "A more specific food description is needed"]
    };
    const routeLabel = routeLabels[routeDecision.route ?? "ai_estimate"];
    progress("route", "complete", routeLabel[0], routeLabel[1]);

    if (isTooManyFoodDecision(routeDecision)) {
      return attachDiagnostics(buildTooManyFoodsResponse(language));
    }

    if (!routeDecision.isFoodRelated || routeDecision.route === "not_food") {
      return respond({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: routeDecision.message || notFoodMessage(language)
      });
    }

    if (routeDecision.route === "local_exact" && hasOnlyStrictLocalMatches) {
      return respond(measureSync("normalize", () => buildStrictLocalResponse(strictLocalMatches, false, language)));
    }

    if (!provider) return missingProviderResponse();

    if (description && (routerMode !== "llm" ? routeDecision.route === "brand_search" : shouldUseBrandSearch(routeDecision, description))) {
      progress("search", "active", "正在联网搜索品牌和产品资料…", "Searching the web for brand and product information…");
      const searchOutcome = await measure("search", () => searchNutritionWithTavily(description, search, signal));
      if (searchOutcome) {
        progress("search", "complete", `已找到 ${search.resultCount} 条公开资料`, `Found ${search.resultCount} public sources`);
        progress("organize", "active", "正在根据资料整理食物和营养…", "Organizing foods and nutrition from the sources…");
        const searchedPayload = await measure("searchLlm", () => extractAiPayloadFromSearch(provider, description, searchOutcome.context, language, signal));
        if (searchedPayload.isFoodRelated && searchedPayload.foods?.length) {
          // A search that returned pages but no matching product numbers is an estimate, not a lookup.
          const found = searchFoundBrandProduct(searchedPayload.foods, brandMatches, searchOutcome.sources);
          const extracted = found ? searchedPayload.foods : searchedPayload.foods.map((food): AiFood => ({ ...food, recognitionMode: "industry-average" }));
          let foods = measureSync("normalize", () => mergeStrictLocalAndAiFoods(strictLocalMatches, extracted, description, "ai-text", language));
          const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
          if (tooManyResponse) return attachDiagnostics(tooManyResponse);
          if (!found) {
            routing.effectiveRoute = "ai_estimate";
            routing.fallbackReason = "search_no_matching_source";
            progress("organize", "warning", "没找到可核对该产品的营养资料，已按同类产品估算", "No source matched this product. Estimated from similar products.");
            return respond({
              ok: true,
              provider: "ai",
              isFoodRelated: true,
              message: localized(language, "没找到该产品可核对的营养资料，已保留品牌并按同类产品估算；请按实际份量调整。", "No source matching this product was found. The brand is kept and values are estimated from similar products; adjust to your actual portion."),
              foods
            });
          }

          const evidence = buildSearchEvidence(id("lookup"), brandMatches, searchOutcome.sources, foods.map(food => food.name),
            foods.flatMap(food => food.brand ? [food.brand] : []));
          if (evidence) foods = foods.map(food => ({ ...food, searchEvidence: evidence }));
          progress("organize", "complete", `已整理 ${foods.length} 项食物及参考资料`, `Organized ${foods.length} foods and references`);
          return respond({
            ok: true,
            provider: "tavily-ai",
            isFoodRelated: true,
            message: searchedPayload.foods.some(food => food.recognitionMode !== "brand-product")
              ? localized(language, "已检索公开资料；结果包含行业估算，请按实际份量调整。", "Public sources were checked; results include estimates. Adjust to your actual portion.")
              : searchedPayload.message || localized(language, "已根据公开营养资料整理结果。", "Results were organized from public nutrition information."),
            foods
          });
        }
        progress("organize", "warning", "公开资料暂不足以生成结果，正在结合食物信息进行营养分析…", "Public sources were insufficient. Analyzing nutrition using the food information…");
      } else {
        progress("search", "warning", "联网搜索失败，正在结合食材组成与份量信息分析营养…",
          "Web search was unsuccessful. Analyzing nutrition using ingredients and portion information…");
      }
    }

    if (routeDecision.route === "ai_estimate" && routeDecision.foods?.length) {
      const cleanedFoods = cleanAiFoodsForDescription(routeDecision.foods, description);
      const foods = mergeStrictLocalAndAiFoods(strictLocalMatches, cleanedFoods, description, "ai-text", language);
      if (foods.length) {
        const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
        if (tooManyResponse) return attachDiagnostics(tooManyResponse);

        return respond({
          ok: true,
          provider: "ai-fast-route",
          isFoodRelated: true,
          message: routeDecision.message || localized(language, "识别好了，已直接估算并放进草稿箱；右侧数值可以继续手动微调。", "Recognized and added to your draft tray; you can still fine-tune the values on the right."),
          foods
        });
      }
    }

    if (routing.effectiveRoute === "brand_search") {
      routing.effectiveRoute = "ai_estimate";
      routing.fallbackReason = search.status === "ok" ? "search_extraction_failed" : `search_${search.status}`;
    }

    if (!description) {
      return respond(
        { ok: false, message: localized(language, "先写一下你吃了什么，我再帮你把营养素估出来。", "Tell me what you ate first so I can estimate the nutrients.") },
        { status: 400 }
      );
    }
    const userContent = buildEstimatePrompt(language, description, analysisDescription, strictLocalMatches);

    const requestBody = buildChatCompletionBody(provider, 1400, [
      {
        role: "system",
        content: "你只输出可以被 JSON.parse 解析的 JSON。估算要稳定，同一句输入保持同一套常见份量假设。"
      },
      {
        role: "user",
        content: userContent
      }
    ]);
    const fallbackFromWeb = routing.selectedRoute === "brand_search";
    progress("estimate", "active", fallbackFromWeb ? "正在结合食材组成与份量信息进行营养分析…" : "正在分析食材、份量和营养…",
      fallbackFromWeb ? "Analyzing nutrition using ingredients and portion information…" : "Analyzing ingredients, portions, and nutrition…");
    const { response, errorText, json } = await measure("estimateLlm", async () => {
      const completion = await requestChatCompletion(provider, requestBody, mainAiTimeoutMs, signal);
      const json = completion.response?.ok ? await completion.response.json() : null;
      return { ...completion, json };
    });

    if (!response?.ok) {
      progress("estimate", "warning", fallbackFromWeb ? "营养分析暂未返回有效结果" : "估算服务暂未返回有效结果",
        fallbackFromWeb ? "Nutrition analysis did not return a usable result" : "The estimation service did not return a usable result");
      if (strictLocalMatches.length) {
        routing.effectiveRoute = "local_exact";
        return respond(buildStrictLocalResponse(strictLocalMatches, true, language));
      }

      const exactLocalResult = canUseFixedLocal ? buildExactLocalResult(description, language) : null;
      if (exactLocalResult) return respond(exactLocalResult);

      return attachDiagnostics(buildAiServiceErrorResponse(response, errorText, language));
    }

    const content = extractAssistantContent(json);
    let parsed = parseAiPayload(content);

    if (shouldRepairAiPayload(parsed, content, description)) {
      progress("repair", "active", "正在校验并修正结果格式…", "Checking and repairing the result format…");
      parsed = await measure("repairLlm", () => repairAiPayload(provider, description, content, parsed, language, signal));
      progress("repair", parsed.foods?.length ? "complete" : "warning", parsed.foods?.length ? "结果格式已整理" : "结果还需要补充信息", parsed.foods?.length ? "Result format checked" : "More information is needed");
    }

    if (!parsed.isFoodRelated || !parsed.foods?.length) {
      progress("estimate", "warning", "未能识别出完整食物，请补充描述", "Could not recognize a complete meal. Please add details.");
      if (strictLocalMatches.length) {
        routing.effectiveRoute = "local_exact";
        return respond(buildStrictLocalResponse(strictLocalMatches, true, language));
      }

      const exactLocalResult = canUseFixedLocal ? buildExactLocalResult(description, language) : null;
      if (exactLocalResult) return respond(exactLocalResult);

      return respond({
        ok: true,
        isFoodRelated: false,
        message: parsed.message || localized(language, "我没算准这餐，可以再补充品牌、主食、配菜或份量。", "I couldn't estimate this meal. Try adding the brand, main item, side, or portion."),
        foods: []
      });
    }

    const source = "ai-text";
    const cleanedFoods = cleanAiFoodsForDescription(parsed.foods, description)
      .map((food): AiFood => ({ ...food, recognitionMode: "industry-average" }));
    const foods = measureSync("normalize", () => mergeStrictLocalAndAiFoods(strictLocalMatches, cleanedFoods, description, source, language));
    const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
    if (tooManyResponse) return attachDiagnostics(tooManyResponse);

    progress("estimate", "complete", fallbackFromWeb ? `已完成 ${foods.length} 项食物的营养分析` : `已估算 ${foods.length} 项食物`,
      fallbackFromWeb ? `Completed nutrition analysis for ${foods.length} foods` : `Estimated ${foods.length} foods`);
    return respond({
      ok: true,
      provider: "ai",
      isFoodRelated: true,
      message: parsed.message || localized(language, "识别好了，右侧数值可以继续手动微调。", "Recognized. You can fine-tune the values on the right."),
      foods
    });
  } catch (error) {
    return attachDiagnostics(buildAiServiceErrorResponse(null, error instanceof Error ? error.message : "", language));
  }
}
