export type Gender = "male" | "female";
export type GoalType = "muscle" | "fat_loss" | "weight_loss" | "health";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "midnight";
export type DietDayStatus = "normal" | "high_carb" | "low_carb" | "high_protein" | "free";

export type MacroTotals = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  fiber: number;
};

export type UserProfile = {
  heightCm: number;
  weightKg: number;
  gender: Gender;
  age: number;
  bmrKcal: number;
  goal: GoalType;
  targetWeightKg: number;
  targetBodyFat?: number;
  bodyFat?: number;
  trainingStyle: string;
  eatingPattern: string;
};

export type DayState = {
  isTrainingDay: boolean;
  trainingPart: string;
  intensity: "light" | "medium" | "hard";
  trainingSets: number;
  durationMinutes: number;
  dietStatus: DietDayStatus;
};

export type FoodLogItem = {
  id: string;
  name: string;
  brand?: string;
  foodType: string;
  portionLabel: string;
  portionScale: number;
  baseMacros: MacroTotals;
  macros: MacroTotals;
  meal: MealType;
  warning?: string;
  source: "mock-vision" | "ai-vision" | "ai-text" | "manual" | "recommendation";
  recognitionMode?: "brand-product" | "industry-average";
  imageName?: string;
  loggedAt: string;
  savedToCalendar?: boolean;
};

export type Recommendation = {
  id: string;
  title: string;
  brand: string;
  category: "meal" | "topup" | "protein" | "snack";
  items: string[];
  macros: MacroTotals;
  note: string;
  caution?: string;
};

export type MacroKey = keyof MacroTotals;

export type DayRecord = {
  dateKey: string;
  day: DayState;
  foods: FoodLogItem[];
};
