import { badRequest, failure, isUuid, mutationResponse, readJson } from "@/lib/cloud/route-helpers";
import { CloudError } from "@/lib/cloud/state";
import { requireApiUser } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Counts a draft into today. Idempotent: repeating it changes nothing. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const scale = (await readJson(request))?.portionScale;
  if (!isUuid(params.id) || (scale !== undefined && (typeof scale !== "number" || !Number.isFinite(scale)))) return badRequest();
  try {
    const result = await auth.admin.rpc("confirm_entry", { p_user: auth.user.id, p_entry_id: params.id, p_portion_scale: scale ?? null });
    if (result.error || !result.data) throw new CloudError(result.error ?? { message: "empty_result" });
    return mutationResponse(result.data);
  } catch (error) {
    return failure(error);
  }
}
