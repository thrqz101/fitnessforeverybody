export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 60;

export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Keeps only digits, capped at the code length (handles pasted "123 456" and autofill). */
export function normalizeOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** Only same-origin absolute paths are allowed as post-login destinations. */
export function safeNextPath(value: string | null | undefined, fallback = "/workspace"): string {
  if (!value || !value.startsWith("/")) return fallback;
  try {
    const parsed = new URL(value, "http://local.invalid");
    return parsed.origin === "http://local.invalid" ? `${parsed.pathname}${parsed.search}` : fallback;
  } catch {
    return fallback;
  }
}

export function resendSecondsLeft(sentAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil(RESEND_SECONDS - (nowMs - sentAtMs) / 1000));
}

export type AuthErrorKind = "rate_limited" | "invalid_code" | "invalid_email" | "network" | "unknown";

export function classifyAuthError(error: { status?: number; code?: string; message?: string } | null | undefined): AuthErrorKind {
  if (!error) return "unknown";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (error.status === 429 || code.includes("rate_limit") || message.includes("rate limit")) return "rate_limited";
  if (code === "email_address_invalid" || code === "validation_failed" || message.includes("email address")) return "invalid_email";
  if (code === "otp_expired" || message.includes("expired") || message.includes("invalid") || message.includes("token")) return "invalid_code";
  if (error.status === 0 || message.includes("fetch") || message.includes("network")) return "network";
  return "unknown";
}
