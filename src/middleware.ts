import type { NextRequest } from "next/server";
import { updateSession } from "@/shared/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// API routes verify the session themselves (requireApiUser), so they skip this extra Auth round trip.
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
