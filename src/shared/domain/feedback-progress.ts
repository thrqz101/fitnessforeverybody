export const feedbackProgressKey = "ffe-feedback-progress-v1";

export type FeedbackProgress = {
  completedBatchIds: string[];
  lastInvitedMilestone: number;
};

export function emptyFeedbackProgress(): FeedbackProgress {
  return { completedBatchIds: [], lastInvitedMilestone: 0 };
}

export function parseFeedbackProgress(raw: string | null): FeedbackProgress {
  if (!raw) return emptyFeedbackProgress();
  try {
    const parsed = JSON.parse(raw);
    const completedBatchIds = Array.isArray(parsed?.completedBatchIds)
      ? Array.from(new Set<string>(parsed.completedBatchIds.filter((id: unknown) => typeof id === "string" && id.length > 0)))
      : [];
    const maximumMilestone = Math.floor(completedBatchIds.length / 5) * 5;
    const lastInvitedMilestone = Number.isInteger(parsed?.lastInvitedMilestone)
      ? Math.min(maximumMilestone, Math.max(0, Math.floor(parsed.lastInvitedMilestone / 5) * 5))
      : 0;
    return { completedBatchIds, lastInvitedMilestone };
  } catch {
    return emptyFeedbackProgress();
  }
}

// A multi-food recognition result is one flow, even if its items are confirmed separately.
export function completeRecognitionFlow(progress: FeedbackProgress, batchId: string | undefined): FeedbackProgress {
  if (!batchId || progress.completedBatchIds.includes(batchId)) return progress;
  return { ...progress, completedBatchIds: [...progress.completedBatchIds, batchId] };
}

export function nextFeedbackMilestone(progress: FeedbackProgress): number | null {
  const next = progress.lastInvitedMilestone + 5;
  return progress.completedBatchIds.length >= next ? next : null;
}

export function acknowledgeFeedbackMilestone(progress: FeedbackProgress, milestone: number): FeedbackProgress {
  if (milestone !== nextFeedbackMilestone(progress)) return progress;
  return { ...progress, lastInvitedMilestone: milestone };
}
