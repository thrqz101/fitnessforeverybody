import { CloudError } from "./state";
import { rpcErrorResponse } from "./errors";
import { dayRowToCloudDay, entryRowToFood } from "./mappers";
import type { DayRow, EntryRow } from "./types";

export const noStore = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function badRequest(code = "invalid_input"): Response {
  return Response.json({ ok: false, code }, { status: 400, headers: noStore });
}

export function failure(error: unknown): Response {
  return rpcErrorResponse(error instanceof CloudError ? error.cause : (error as { message?: string; code?: string }) ?? null);
}

export function mutationResponse(result: { entry: EntryRow; day: DayRow | null }): Response {
  return Response.json({
    ok: true,
    food: entryRowToFood(result.entry),
    day: result.day ? dayRowToCloudDay(result.day) : null
  }, { headers: noStore });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
