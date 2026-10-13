import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodLogItem } from "@/shared/domain/types";
import { entryRowToFood, foodToEntryPayload } from "@/shared/api/mappers";
import type { EntryRow } from "@/shared/api/types";

export type PersistOutcome =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

const MAX_OUTPUT_CHARS = 200_000;

function storedOutput(body: Record<string, unknown>) {
  const { diagnostics: _diagnostics, ...rest } = body;
  const text = JSON.stringify(rest);
  if (text.length <= MAX_OUTPUT_CHARS) return rest;
  return { ok: rest.ok, isFoodRelated: rest.isFoodRelated, message: rest.message, provider: rest.provider, routing: rest.routing, truncated: true };
}

function errorClass(body: Record<string, unknown>): string {
  if (typeof body.code === "string") return body.code.slice(0, 80);
  if (body.needsConfig === true) return "needs_config";
  return "provider_error";
}

/**
 * Stores the raw recognition output and creates the draft entries. On success the returned body carries the
 * saved entries (cloud ids) instead of the transient foods; on failure the caller must not report success.
 */
export async function persistRecognition(
  admin: SupabaseClient, userId: string, requestId: string,
  body: Record<string, unknown>, route: string | null, language: "zh" | "en"
): Promise<PersistOutcome> {
  const foods = Array.isArray(body.foods) ? (body.foods as FoodLogItem[]) : [];
  const recognized = body.ok === true && body.isFoodRelated === true && foods.length > 0;
  const payloads = recognized ? foods.map((food) => foodToEntryPayload(food, "ai-text")) : [];
  const unusable = recognized && payloads.some((payload) => !payload.baseMacros);
  const status = unusable ? "failed" : recognized ? "succeeded" : body.ok === true ? "not_food" : "failed";

  const saved = await admin.rpc("complete_recognition", {
    p_user: userId,
    p_request_id: requestId,
    p_status: status,
    p_route: route,
    p_output: storedOutput(body),
    p_error_class: status === "failed" ? (unusable ? "invalid_result" : errorClass(body)) : null,
    p_foods: status === "succeeded" ? payloads : []
  });
  if (saved.error || !saved.data || unusable) {
    return { ok: false, status: 502, body: {
      ok: false, code: "persist_failed", retryable: true,
      message: language === "en" ? "The result could not be saved. Please try again." : "识别结果暂时没能保存，请再试一次。"
    } };
  }
  if (status === "succeeded") {
    const entries = (saved.data as { entries: EntryRow[] }).entries ?? [];
    return { ok: true, body: { ...body, foods: entries.map(entryRowToFood) } };
  }
  return { ok: true, body };
}
