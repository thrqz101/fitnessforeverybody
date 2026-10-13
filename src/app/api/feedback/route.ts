import { badRequest, failure, noStore, readJson } from "@/shared/api/route-helpers";
import { CloudError } from "@/shared/api/state";
import { parseFeedback } from "@/shared/api/validate";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stores private feedback. The same dedupeId always maps to one row, so retries and double clicks are safe. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const input = parseFeedback(await readJson(request));
  if (!input) return badRequest();
  try {
    const saved = await auth.admin.rpc("submit_feedback", {
      p_user: auth.user.id, p_dedupe_id: input.dedupeId, p_kind: input.kind, p_message: input.message, p_contact: input.contact
    });
    if (saved.error || !saved.data) throw new CloudError(saved.error ?? { message: "empty_result" });
    return Response.json({ ok: true, id: saved.data.id }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
