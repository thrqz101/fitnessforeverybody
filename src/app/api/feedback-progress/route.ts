import { badRequest, failure, noStore, readJson } from "@/shared/api/route-helpers";
import { CloudError } from "@/shared/api/state";
import { emptyFeedbackProgress, parseFeedbackProgress } from "@/shared/domain/feedback-progress";
import { requireApiUser } from "@/shared/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stores the feedback-invitation milestones (client-owned, not used for statistics). */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body?.progress || typeof body.progress !== "object") return badRequest();
  const progress = parseFeedbackProgress(JSON.stringify(body.progress)) ?? emptyFeedbackProgress();
  try {
    const result = await auth.admin.rpc("update_feedback_progress", { p_user: auth.user.id, p_progress: progress });
    if (result.error) throw new CloudError(result.error);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
