import { badRequest, failure, noStore, readJson } from "@/lib/cloud/route-helpers";
import { profileRowToProfile } from "@/lib/cloud/mappers";
import { CloudError, writeTodaySnapshot } from "@/lib/cloud/state";
import type { ProfileRow } from "@/lib/cloud/types";
import { parseDay } from "@/lib/cloud/validate";
import { requireApiUser } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Updates today's training/diet settings; the goal snapshot is recomputed from the stored profile. */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const day = parseDay((await readJson(request))?.day);
  if (!day) return badRequest();
  try {
    const row = await auth.admin.rpc("ensure_profile", { p_user: auth.user.id });
    if (row.error || !row.data) throw new CloudError(row.error ?? { message: "empty_result" });
    const profile = profileRowToProfile(row.data as ProfileRow);
    if (!profile) throw new CloudError({ message: "day_not_ready" });
    return Response.json({ ok: true, day: await writeTodaySnapshot(auth.admin, auth.user.id, profile, day) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
