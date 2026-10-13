import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateTargets, defaultDayState } from "../nutrition";
import type { DayState, UserProfile } from "../types";
import { dayRowToCloudDay, entryRowToFood, profileRowToProfile } from "./mappers";
import type { CloudDay, CloudState, DayRow, EntryRow, ProfileRow } from "./types";

const WINDOW_DAYS = 400;
const ENTRY_LIMIT = 5000;

export class CloudError extends Error {
  constructor(public readonly cause: { message?: string; code?: string }) { super(cause.message ?? "cloud_error"); }
}

function orThrow<T>(result: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (result.error || result.data === null) throw new CloudError(result.error ?? { message: "empty_result" });
  return result.data;
}

/** Computes targets with the shared nutrition formulas and stores them as today's snapshot. */
export async function writeTodaySnapshot(admin: SupabaseClient, userId: string, profile: UserProfile, day: DayState): Promise<CloudDay> {
  const targets = calculateTargets(profile, day);
  const row = orThrow<DayRow>(await admin.rpc("upsert_day_snapshot", { p_user: userId, p_day: day, p_targets: targets, p_profile: profile }));
  return dayRowToCloudDay(row);
}

type RawCloudState = { profile: ProfileRow; today: string; days: DayRow[]; entries: EntryRow[] };

/**
 * Reads the authoritative state in one database round trip and, when the account is set up but today has no
 * goal snapshot yet (first visit of a new Beijing day), writes it with one more call.
 */
export async function loadCloudState(admin: SupabaseClient, userId: string): Promise<CloudState> {
  const raw = orThrow<RawCloudState>(await admin.rpc("get_cloud_state", { p_user: userId, p_window_days: WINDOW_DAYS, p_entry_limit: ENTRY_LIMIT }));
  const profile = profileRowToProfile(raw.profile);
  const days: Record<string, CloudDay> = Object.fromEntries(raw.days.map((row) => [row.activity_date, dayRowToCloudDay(row)]));
  if (profile && !days[raw.today]) days[raw.today] = await writeTodaySnapshot(admin, userId, profile, defaultDayState);

  return {
    today: raw.today,
    setupCompleted: raw.profile.setup_completed,
    profile,
    profileVersion: raw.profile.version,
    localImportState: raw.profile.local_import_state,
    feedbackProgress: raw.profile.feedback_progress,
    days,
    foods: raw.entries.map(entryRowToFood)
  };
}
