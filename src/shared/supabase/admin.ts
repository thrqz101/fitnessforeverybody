import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let admin: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS and is the only way to call the write functions.
 * Server-only. Never pass a user id from the request body; take it from the verified session.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret || secret.startsWith("op://")) return null;
  admin ??= createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
