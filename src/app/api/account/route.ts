import { badRequest, noStore, readJson } from "@/shared/api/route-helpers";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently deletes the account and, through foreign-key cascades, its profile, recognition inputs and
 * outputs, food log, daily results and feedback. The caller must type their own email as confirmation.
 */
export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const confirm = (await readJson(request))?.confirm;
  const email = auth.user.email?.toLowerCase();
  if (!email || typeof confirm !== "string" || confirm.trim().toLowerCase() !== email) return badRequest("confirm_mismatch");
  const removed = await auth.admin.auth.admin.deleteUser(auth.user.id);
  if (removed.error) return Response.json({ ok: false, code: "backend_error" }, { status: 502 });
  return Response.json({ ok: true }, { headers: noStore });
}
