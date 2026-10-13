import { failure, noStore } from "@/lib/cloud/route-helpers";
import { loadCloudState } from "@/lib/cloud/state";
import { requireApiUser } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full authoritative state for the signed-in user; makes sure today's goal snapshot exists. */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  try {
    return Response.json({ ok: true, state: await loadCloudState(auth.admin, auth.user.id) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
