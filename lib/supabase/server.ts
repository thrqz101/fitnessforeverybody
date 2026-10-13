import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

/** Session-bound server client for route handlers and Server Components (publishable key + user cookies). */
export function createSessionSupabase(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const cookieStore = cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the middleware refreshes the session cookies instead.
        }
      }
    }
  });
}
