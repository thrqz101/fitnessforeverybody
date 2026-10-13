type RpcError = { message?: string; code?: string } | null | undefined;

const known: Record<string, [number, string]> = {
  version_conflict: [409, "version_conflict"],
  day_closed: [409, "day_closed"],
  day_not_ready: [409, "day_not_ready"],
  entry_not_found: [404, "entry_not_found"],
  entry_deleted: [409, "entry_deleted"],
  request_conflict: [409, "request_conflict"],
  rate_limited: [429, "rate_limited"],
  invalid_profile: [400, "invalid_input"],
  invalid_targets: [400, "invalid_input"],
  invalid_scale: [400, "invalid_input"],
  invalid_source: [400, "invalid_input"],
  invalid_input: [400, "invalid_input"],
  invalid_foods: [400, "invalid_input"],
  invalid_payload: [400, "invalid_input"]
};

/** Maps a database exception to an HTTP status and a stable client-facing code (never the raw message). */
export function mapRpcError(error: RpcError): { status: number; code: string } {
  const message = error?.message ?? "";
  if (known[message]) return { status: known[message][0], code: known[message][1] };
  if (error?.code === "23514" || error?.code === "22P02" || error?.code === "22007") return { status: 400, code: "invalid_input" };
  if (error?.code === "23505") return { status: 409, code: "conflict" };
  return { status: 502, code: "backend_error" };
}

export function rpcErrorResponse(error: RpcError): Response {
  const { status, code } = mapRpcError(error);
  return Response.json({ ok: false, code }, { status });
}
