/** Public Supabase settings. When unset the app runs in its legacy local-only mode (no login). */
export function getSupabasePublicConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key && !key.startsWith("op://") ? { url, key } : null;
}
