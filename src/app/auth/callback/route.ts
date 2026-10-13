import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/shared/auth/helpers";
import { createSessionSupabase } from "@/shared/supabase/server";

export const runtime = "nodejs";

/** Completes email-link sign-ins (PKCE code exchange). The 6-digit code flow does not use this route. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const supabase = createSessionSupabase();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?auth=failed`);
}
