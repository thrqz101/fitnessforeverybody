import type { DayState, FoodLogItem, UserProfile } from "../types";
import type { Language } from "../i18n-utils";
import type { CloudDay, CloudState } from "./types";
import type { FeedbackProgress } from "../feedback-progress";

export class CloudApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

async function call<T extends object>(url: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    throw new CloudApiError(0, "network");
  }
  const json = (await response.json().catch(() => null)) as ({ ok?: boolean; code?: string } & T) | null;
  if (!response.ok || !json || json.ok === false) throw new CloudApiError(response.status, json?.code ?? "backend_error");
  return json;
}

export type EntryResult = { food: FoodLogItem; day: CloudDay | null };

export const cloudApi = {
  sync: async () => (await call<{ state: CloudState }>("/api/sync", "POST")).state,
  saveProfile: (profile: UserProfile, day: DayState, expectedVersion: number | null) =>
    call<{ profileVersion: number; day: CloudDay }>("/api/profile", "PUT", { profile, day, expectedVersion }),
  saveDay: async (day: DayState) => (await call<{ day: CloudDay }>("/api/day", "PUT", { day })).day,
  createEntry: (food: FoodLogItem, source: "manual" | "recommendation", confirm: boolean) =>
    call<EntryResult>("/api/entries", "POST", { food, source, confirm }),
  confirmEntry: (id: string, portionScale?: number) =>
    call<EntryResult>(`/api/entries/${id}/confirm`, "POST", portionScale === undefined ? {} : { portionScale }),
  setPortion: (id: string, portionScale: number) => call<EntryResult>(`/api/entries/${id}`, "PATCH", { portionScale }),
  deleteEntry: (id: string) => call<EntryResult>(`/api/entries/${id}`, "DELETE"),
  saveFeedbackProgress: (progress: FeedbackProgress) => call<object>("/api/feedback-progress", "PUT", { progress })
};

const messages: Record<string, [string, string]> = {
  unauthenticated: ["登录已过期，请重新登录。", "Your session has expired. Please sign in again."],
  day_closed: ["这一天已经结束，记录不能再修改。", "That day has ended, so its records can no longer be changed."],
  day_not_ready: ["请先保存身体资料。", "Please save your body profile first."],
  entry_not_found: ["这条记录已不存在。", "That record no longer exists."],
  entry_deleted: ["这条记录已被删除。", "That record was already deleted."],
  version_conflict: ["资料已在其他设备更新，已为你刷新，请再确认一次。", "Your profile was updated on another device. It has been refreshed; please review and save again."],
  rate_limited: ["操作太频繁，请稍后再试。", "Too many requests. Please try again shortly."],
  invalid_input: ["提交的内容不符合要求，请检查后重试。", "Some of the values are not valid. Please check and try again."],
  network: ["网络连接失败，请重试。", "Network error. Please try again."],
  backend_unconfigured: ["云端服务暂不可用。", "The cloud service is unavailable right now."]
};

export function describeCloudCode(code: string, language: Language): string {
  const pair = messages[code] ?? ["保存失败，请再试一次。", "Saving failed. Please try again."];
  return language === "en" ? pair[1] : pair[0];
}

export function describeCloudError(error: unknown, language: Language): string {
  return describeCloudCode(error instanceof CloudApiError ? error.code : "backend_error", language);
}
