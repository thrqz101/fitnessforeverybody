import { badRequest, failure, noStore, readJson } from "@/shared/api/route-helpers";
import { writeTodaySnapshot } from "@/shared/api/state";
import { CloudError } from "@/shared/api/state";
import { parseDay, parseProfile } from "@/shared/api/validate";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saves body profile + today's settings; the server recomputes today's goal snapshot. */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  const profile = parseProfile(body?.profile);
  const day = parseDay(body?.day);
  const expected = body?.expectedVersion;
  if (!profile || !day || (expected !== undefined && expected !== null && !Number.isInteger(expected))) return badRequest();
  try {
    const saved = await auth.admin.rpc("upsert_profile", {
      p_user: auth.user.id, p_profile: profile, p_expected_version: expected ?? null
    });
    if (saved.error || !saved.data) throw new CloudError(saved.error ?? { message: "empty_result" });
    const today = await writeTodaySnapshot(auth.admin, auth.user.id, profile, day);
    return Response.json({ ok: true, profileVersion: saved.data.version, day: today }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
