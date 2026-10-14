import { previewFoodRoute } from "@/features/recognition/server/route-preview";
import { readJson } from "@/shared/api/route-helpers";
import { normalizeLanguage } from "@/shared/i18n/i18n-utils";
import { requireApiUser } from "@/shared/supabase/api-auth";
import { getSupabasePublicConfig } from "@/shared/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Typing-time route preview. Signed-in users only when the backend is configured, like recognition itself. */
export async function POST(request: Request) {
  if (getSupabasePublicConfig()) {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
  }
  const body = await readJson(request);
  const description = typeof body?.description === "string" ? body.description : "";
  return Response.json({ ok: true, preview: await previewFoodRoute(description, normalizeLanguage(body?.lang), request.signal) }, { headers: { "Cache-Control": "no-store" } });
}
