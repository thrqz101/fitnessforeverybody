import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "../supabase/config";
import { requireApiUser } from "../supabase/api-auth";
import { rpcErrorResponse } from "./errors";
import { entryRowToFood } from "./mappers";
import { isUuid } from "./route-helpers";
import type { EntryRow } from "./types";

export type CloudRun = { admin: SupabaseClient; userId: string; requestId: string };
export type CloudRecognitionStart =
  | { mode: "off" }
  | { mode: "reply"; response: Response }
  | { mode: "run"; run: CloudRun };

/** Idempotent entry into a recognition: verifies the session, registers the request id, reuses finished results. */
export async function beginCloudRecognition(form: FormData, description: string, language: "zh" | "en"): Promise<CloudRecognitionStart> {
  if (!getSupabasePublicConfig()) return { mode: "off" };
  const auth = await requireApiUser();
  if (auth instanceof Response) return { mode: "reply", response: auth };

  const requestId = form.get("requestId");
  if (!isUuid(requestId)) return { mode: "reply", response: Response.json({ ok: false, code: "invalid_input" }, { status: 400 }) };

  const begun = await auth.admin.rpc("begin_recognition", { p_user: auth.user.id, p_request_id: requestId, p_input: description });
  if (begun.error || !begun.data) return { mode: "reply", response: rpcErrorResponse(begun.error ?? { message: "empty_result" }) };

  const data = begun.data as { state: "new" | "processing" | "done"; status?: string; output?: { message?: string } | null; entries?: EntryRow[] };
  if (data.state === "new") return { mode: "run", run: { admin: auth.admin, userId: auth.user.id, requestId } };
  if (data.state === "processing") {
    return { mode: "reply", response: Response.json({
      ok: false, code: "processing", retryable: true,
      message: language === "en" ? "This request is still being processed. Please try again in a moment." : "这次识别还在处理中，请稍后再试。"
    }, { status: 409 }) };
  }
  const succeeded = data.status === "succeeded";
  return { mode: "reply", response: Response.json({
    ok: true, provider: "saved", isFoodRelated: succeeded,
    message: data.output?.message,
    foods: succeeded ? (data.entries ?? []).map(entryRowToFood) : []
  }) };
}
