import { badRequest, failure, isUuid, mutationResponse, readJson } from "@/shared/api/route-helpers";
import { CloudError } from "@/shared/api/state";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

/** Changes the portion scale of a draft or of today's confirmed entry. */
export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const scale = (await readJson(request))?.portionScale;
  if (!isUuid(params.id) || typeof scale !== "number" || !Number.isFinite(scale)) return badRequest();
  try {
    const result = await auth.admin.rpc("update_entry_portion", { p_user: auth.user.id, p_entry_id: params.id, p_portion_scale: scale });
    if (result.error || !result.data) throw new CloudError(result.error ?? { message: "empty_result" });
    return mutationResponse(result.data);
  } catch (error) {
    return failure(error);
  }
}

/** Deletes a draft, or a confirmed entry while its Beijing day is still open. */
export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!isUuid(params.id)) return badRequest();
  try {
    const result = await auth.admin.rpc("delete_entry", { p_user: auth.user.id, p_entry_id: params.id });
    if (result.error || !result.data) throw new CloudError(result.error ?? { message: "empty_result" });
    return mutationResponse(result.data);
  } catch (error) {
    return failure(error);
  }
}
