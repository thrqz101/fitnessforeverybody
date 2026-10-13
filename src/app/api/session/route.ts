import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who am I: verifies the session and makes sure the profile row exists. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.admin.rpc("ensure_profile", { p_user: auth.user.id });
  if (error) return Response.json({ ok: false, code: "profile_unavailable" }, { status: 502 });
  return Response.json({
    ok: true,
    user: { id: auth.user.id, email: auth.user.email },
    profile: { setupCompleted: data.setup_completed, version: data.version, localImportState: data.local_import_state }
  });
}
