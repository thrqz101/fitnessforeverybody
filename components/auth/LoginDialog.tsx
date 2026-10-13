"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PreviewDialog } from "@/components/preview/PreviewDialog";
import { usePreviewText } from "@/components/preview/PreviewChrome";
import { classifyAuthError, isPlausibleEmail, normalizeOtp, OTP_LENGTH, resendSecondsLeft, type AuthErrorKind } from "@/lib/auth/helpers";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const text = usePreviewText();
  const supabase = getBrowserSupabase();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    codeRef.current?.focus();
    return () => window.clearInterval(timer);
  }, [step]);

  const wait = step === "code" ? resendSecondsLeft(sentAt, now) : 0;
  const errorText: Record<AuthErrorKind, string> = {
    rate_limited: text("发送太频繁，请稍后再试。", "Too many requests. Please wait a moment."),
    invalid_code: text("验证码不正确或已过期，请重新获取。", "That code is wrong or has expired. Please request a new one."),
    invalid_email: text("请输入有效的邮箱地址。", "Please enter a valid email address."),
    network: text("网络连接失败，请重试。", "Network error. Please try again."),
    unknown: text("登录暂未完成，请再试一次。", "Sign-in could not finish. Please try again.")
  };

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !supabase) return;
    const address = email.trim().toLowerCase();
    if (!isPlausibleEmail(address)) { setError("invalid_email"); return; }
    setBusy(true); setError(null);
    const { error: failure } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (failure) { setError(classifyAuthError(failure)); return; }
    setEmail(address); setCode(""); setSentAt(Date.now()); setNow(Date.now()); setStep("code");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !supabase) return;
    if (code.length !== OTP_LENGTH) { setError("invalid_code"); return; }
    setBusy(true); setError(null);
    const { error: failure } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (failure) { setError(classifyAuthError(failure)); setCode(""); codeRef.current?.focus(); }
    // On success AuthProvider receives the session and closes this dialog.
  }

  return <PreviewDialog title={text("登录 Fitness for Everybody", "Sign in to Fitness for Everybody")} onClose={onClose}>
    {step === "email" ? <form className="precision-feedback-form" onSubmit={sendCode} noValidate>
      <p className="text-sm text-zinc-500 leading-relaxed">{text("输入邮箱，我们会发送一个 6 位验证码。无需密码，首次登录会自动创建账号。", "Enter your email and we'll send a 6-digit code. No password needed; your account is created on first sign-in.")}</p>
      <label>{text("邮箱", "Email")}
        <input type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={error === "invalid_email"} aria-describedby={error ? "login-error" : undefined} />
      </label>
      {error && <p id="login-error" role="alert" className="precision-auth-error">{errorText[error]}</p>}
      <button type="submit" className="precision-button" disabled={busy || !email.trim()}>{busy ? text("发送中…", "Sending…") : text("发送验证码", "Send code")}</button>
    </form> : <form className="precision-feedback-form" onSubmit={verify} noValidate>
      <p className="text-sm text-zinc-500 leading-relaxed" role="status">{text(`验证码已发送至 ${email}，10 分钟内有效。`, `We sent a code to ${email}. It is valid for 10 minutes.`)}</p>
      <label>{text("6 位验证码", "6-digit code")}
        <input ref={codeRef} className="precision-otp-input" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={OTP_LENGTH + 4} required value={code} onChange={(event) => setCode(normalizeOtp(event.target.value))} aria-invalid={error === "invalid_code"} aria-describedby={error ? "login-error" : undefined} />
      </label>
      {error && <p id="login-error" role="alert" className="precision-auth-error">{errorText[error]}</p>}
      <button type="submit" className="precision-button" disabled={busy || code.length !== OTP_LENGTH}>{busy ? text("验证中…", "Verifying…") : text("登录", "Sign in")}</button>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="precision-button precision-button--secondary" disabled={busy || wait > 0} onClick={() => void sendCode()}>
          {wait > 0 ? text(`${wait} 秒后可重新发送`, `Resend in ${wait}s`) : text("重新发送验证码", "Resend code")}
        </button>
        <button type="button" className="precision-button precision-button--secondary" disabled={busy} onClick={() => { setStep("email"); setError(null); setCode(""); }}>{text("更换邮箱", "Use another email")}</button>
      </div>
    </form>}
  </PreviewDialog>;
}
