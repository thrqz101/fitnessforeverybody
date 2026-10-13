import type { DayState, FoodLogItem, MacroTotals, UserProfile } from "../types";

export type LocalImportState = "pending" | "imported" | "skipped";

/** One Beijing day as stored by the backend (goal snapshot + server-computed results). */
export type CloudDay = {
  dateKey: string;
  day: DayState;
  targets: MacroTotals | null;
  totals: MacroTotals;
  flows: number;
  score: number | null;
  finalized: boolean;
  effective: boolean | null;
  migrated: boolean;
};

export type CloudState = {
  /** Current Beijing date according to the database. */
  today: string;
  setupCompleted: boolean;
  profile: UserProfile | null;
  profileVersion: number;
  localImportState: LocalImportState;
  feedbackProgress: unknown;
  days: Record<string, CloudDay>;
  /** Confirmed entries for the loaded window plus today's drafts. */
  foods: FoodLogItem[];
};

export type EntryRow = {
  id: string;
  request_id: string | null;
  source: "ai-text" | "manual" | "recommendation" | "import";
  name: string;
  brand: string | null;
  meal: string;
  item: Record<string, unknown> | null;
  base_macros: MacroTotals;
  portion_scale: number;
  final_macros: MacroTotals;
  status: "draft" | "confirmed" | "deleted";
  entry_date: string;
  confirmed_at: string | null;
  created_at: string;
};

export type DayRow = {
  activity_date: string;
  day_settings: unknown;
  targets: MacroTotals | null;
  totals: MacroTotals;
  confirmed_flows: number;
  score: number | string | null;
  finalized_at: string | null;
  is_effective: boolean | null;
  migrated: boolean;
};

export type ProfileRow = {
  user_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  age: number | null;
  bmr_kcal: number | null;
  goal: string | null;
  target_weight_kg: number | null;
  target_body_fat: number | null;
  body_fat: number | null;
  training_style: string | null;
  eating_pattern: string | null;
  macro_multipliers: unknown;
  fiber_grams: number | null;
  setup_completed: boolean;
  feedback_progress: unknown;
  local_import_state: LocalImportState;
  version: number;
};

/** Result of a mutation on an entry: the entry plus the refreshed day (null for drafts). */
