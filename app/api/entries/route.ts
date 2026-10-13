import { foodToEntryPayload } from "@/lib/cloud/mappers";
import { badRequest, failure, mutationResponse, readJson } from "@/lib/cloud/route-helpers";
import { CloudError } from "@/lib/cloud/state";
import type { EntryRow } from "@/lib/cloud/types";
import { requireApiUser } from "@/lib/supabase/api-auth";
import type { FoodLogItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a manual / recommendation entry. With confirm=true it is counted into today in the same call.
 * AI-recognized entries are created by /api/food-ai and are only confirmed through /api/entries/[id]/confirm.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  const source = body?.source;
  const food = body?.food as FoodLogItem | undefined;
  if ((source !== "manual" && source !== "recommendation") || !food || typeof food !== "object") return badRequest();
  const payload = foodToEntryPayload(food, source);
  if (!payload.baseMacros) return badRequest();
  const scale = typeof body?.portionScale === "number" ? body.portionScale : undefined;

  try {
    const created = await auth.admin.rpc("create_manual_entry", { p_user: auth.user.id, p_entry: payload });
    if (created.error || !created.data) throw new CloudError(created.error ?? { message: "empty_result" });
    const entry = created.data as EntryRow;
    if (body?.confirm !== true) return mutationResponse({ entry, day: null });

    const confirmed = await auth.admin.rpc("confirm_entry", { p_user: auth.user.id, p_entry_id: entry.id, p_portion_scale: scale ?? null });
    if (confirmed.error || !confirmed.data) {
      await auth.admin.rpc("delete_entry", { p_user: auth.user.id, p_entry_id: entry.id });
      throw new CloudError(confirmed.error ?? { message: "empty_result" });
    }
    return mutationResponse(confirmed.data);
  } catch (error) {
    return failure(error);
  }
}
