import { badRequest, failure, noStore, readJson } from "@/shared/api/route-helpers";
import { sanitizeImport } from "@/shared/api/import";
import { CloudError } from "@/shared/api/state";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-time import of this device's old local records ({records}) or an explicit decline ({skip:true}).
 * Imported days never count as recognition flows and never get an effectiveness verdict.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  try {
    if (body?.skip === true) {
      const skipped = await auth.admin.from("profiles").update({ local_import_state: "skipped", updated_at: new Date().toISOString() })
        .eq("user_id", auth.user.id).eq("local_import_state", "pending");
      if (skipped.error) throw new CloudError(skipped.error);
      return Response.json({ ok: true, imported: 0, skippedDays: 0 }, { headers: noStore });
    }
    const today = await auth.admin.rpc("app_today");
    if (today.error || !today.data) throw new CloudError(today.error ?? { message: "empty_result" });
    const payload = sanitizeImport(body, today.data as string);
    if (!payload) return badRequest();
    const result = await auth.admin.rpc("import_local_records", { p_user: auth.user.id, p_payload: { records: payload.records } });
    if (result.error || !result.data) throw new CloudError(result.error ?? { message: "empty_result" });
    return Response.json({ ok: true, imported: result.data.imported, skippedDays: result.data.skippedDays }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
