import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminSupabase } from "./admin";
import { createSessionSupabase } from "./server";

export type ApiAuth = { user: User; admin: SupabaseClient };

/**
 * Verifies the session cookie against the Auth server and returns the user plus a service-role client.
 * Returns a ready-to-send error Response when the caller is not signed in or the backend is not configured.
 */
export async function requireApiUser(): Promise<ApiAuth | Response> {
  const session = createSessionSupabase();
  const admin = getAdminSupabase();
  if (!session || !admin) return Response.json({ ok: false, code: "backend_unconfigured" }, { status: 503 });
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) return Response.json({ ok: false, code: "unauthenticated" }, { status: 401 });
  return { user: data.user, admin };
}
