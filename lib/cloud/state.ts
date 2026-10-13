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

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Computes targets with the shared nutrition formulas and stores them as today's snapshot. */
export async function writeTodaySnapshot(admin: SupabaseClient, userId: string, profile: UserProfile, day: DayState): Promise<CloudDay> {
  const targets = calculateTargets(profile, day);
  const row = orThrow<DayRow>(await admin.rpc("upsert_day_snapshot", { p_user: userId, p_day: day, p_targets: targets, p_profile: profile }));
  return dayRowToCloudDay(row);
}

/** Reads (and, when the account is set up, makes sure today has) the authoritative state. */
export async function loadCloudState(admin: SupabaseClient, userId: string): Promise<CloudState> {
  const profileRow = orThrow<ProfileRow>(await admin.rpc("ensure_profile", { p_user: userId }));
  const today = orThrow<string>(await admin.rpc("app_today"));
  const profile = profileRowToProfile(profileRow);
  const from = shiftDate(today, -WINDOW_DAYS);

  if (profile) {
    const existing = await admin.from("daily_activity").select("activity_date").eq("user_id", userId).eq("activity_date", today).maybeSingle();
    if (existing.error) throw new CloudError(existing.error);
    if (!existing.data) await writeTodaySnapshot(admin, userId, profile, defaultDayState);
  }

  const [days, entries] = await Promise.all([
    admin.from("daily_activity").select("*").eq("user_id", userId).gte("activity_date", from).order("activity_date", { ascending: false }),
    admin.from("food_entries").select("*").eq("user_id", userId).gte("entry_date", from)
      .or(`status.eq.confirmed,and(status.eq.draft,entry_date.eq.${today})`)
      .order("created_at", { ascending: false }).limit(ENTRY_LIMIT)
  ]);
  const dayRows = orThrow<DayRow[]>(days);
  const entryRows = orThrow<EntryRow[]>(entries);

  return {
    today,
    setupCompleted: profileRow.setup_completed,
    profile,
    profileVersion: profileRow.version,
    localImportState: profileRow.local_import_state,
    feedbackProgress: profileRow.feedback_progress,
    days: Object.fromEntries(dayRows.map((row) => [row.activity_date, dayRowToCloudDay(row)])),
    foods: entryRows.map(entryRowToFood)
  };
}
