import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let client: SupabaseClient | null = null;

/** Browser client (publishable key only). Returns null when Supabase is not configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
