import { runAgent } from "@/lib/agent/run-agent";
import { normalizeLanguage } from "@/lib/i18n-utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { query?: unknown; lang?: unknown } | null;
    const query = String(body?.query ?? "").trim();
    const language = normalizeLanguage(body?.lang);

    if (!query) {
      return Response.json({ ok: false, message: "请提供 query。" }, { status: 400 });
    }

    const result = await runAgent(query, language);

    if (!result.ok) {
      if (result.needsConfig) {
        return Response.json({ ok: false, needsConfig: true, message: result.error }, { status: 503 });
      }
      return Response.json({ ok: false, message: result.error, provenance: result.provenance }, { status: 502 });
    }

    return Response.json({
      ok: true,
      answer: result.answer,
      provenance: result.provenance,
      dbMeta: result.dbMeta
    });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
