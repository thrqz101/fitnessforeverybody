"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PreviewDialog } from "@/components/preview/PreviewDialog";
import { usePreviewText } from "@/components/preview/PreviewChrome";
import { classifyAuthError, isPlausibleEmail, normalizeOtp, OTP_LENGTH, resendSecondsLeft, type AuthErrorKind } from "@/lib/auth/helpers";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * One screen: the email field and the six code boxes are always visible. The boxes unlock once a code has been
 * sent to the address in the field, and a complete code signs in automatically.
 */
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const text = usePreviewText();
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);
  const [focused, setFocused] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const attempted = useRef("");

  const address = email.trim().toLowerCase();
  // The code is only valid for the address it was sent to; editing the address locks the boxes again.
  const codeReady = sentTo !== null && sentTo === address;
  const wait = codeReady ? resendSecondsLeft(sentAt, now) : 0;
  const activeBox = Math.min(code.length, OTP_LENGTH - 1);

  useEffect(() => {
    if (!codeReady) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [codeReady]);

  useEffect(() => {
    if (codeReady && !verifying) codeRef.current?.focus();
  }, [codeReady, verifying]);

  useEffect(() => {
    if (!codeReady || verifying || code.length !== OTP_LENGTH || attempted.current === code) return;
    attempted.current = code;
    void verify(code);
  }, [code, codeReady, verifying]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorText: Record<AuthErrorKind, string> = {
    rate_limited: text("发送太频繁，请稍后再试。", "Too many requests. Please wait a moment."),
    invalid_code: text("验证码不正确或已过期，请重新输入或重新发送。", "That code is wrong or has expired. Try again or send a new one."),
    invalid_email: text("请输入有效的邮箱地址。", "Please enter a valid email address."),
    network: text("网络连接失败，请重试。", "Network error. Please try again."),
    unknown: text("登录暂未完成，请再试一次。", "Sign-in could not finish. Please try again.")
  };

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (sending || verifying || !supabase || wait > 0) return;
    if (!isPlausibleEmail(address)) { setError("invalid_email"); return; }
    setSending(true); setError(null);
    const { error: failure } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setSending(false);
    if (failure) { setError(classifyAuthError(failure)); return; }
    attempted.current = "";
    setCode("");
    setSentAt(Date.now()); setNow(Date.now()); setSentTo(address);
  }

  async function verify(token: string) {
    if (!supabase) return;
    setVerifying(true); setError(null);
    const { error: failure } = await supabase.auth.verifyOtp({ email: address, token, type: "email" });
    // On success AuthProvider receives the session and closes this dialog.
    if (failure) {
      setError(classifyAuthError(failure));
      attempted.current = "";
      setCode("");
      setVerifying(false);
      window.setTimeout(() => codeRef.current?.focus(), 0);
    }
  }

  const sendLabel = sending ? text("发送中…", "Sending…")
    : codeReady ? (wait > 0 ? text(`${wait} 秒后可重发`, `Resend in ${wait}s`) : text("重新发送", "Resend"))
    : text("发送验证码", "Send code");

  return <PreviewDialog title={text("登录 Fitness for Everybody", "Sign in to Fitness for Everybody")} onClose={onClose}>
    <form className="precision-feedback-form" onSubmit={sendCode} noValidate>
      <p className="text-sm text-zinc-500 leading-relaxed">{text(
        "输入邮箱获取 6 位验证码，输满后自动登录。无需密码，每个邮箱对应一个独立账号，首次登录会自动创建。",
        "Enter your email to get a 6-digit code; it signs you in as soon as you finish typing it. No password needed. Each email is its own account, created on first sign-in.")}</p>

      <div className="grid gap-2">
        <label htmlFor="login-email" className="text-[13px]">{text("邮箱", "Email")}</label>
        <div className="precision-login-row">
          <input id="login-email" type="email" name="email" autoComplete="email" inputMode="email" required value={email}
            onChange={(event) => { setEmail(event.target.value); setError(null); }}
            aria-invalid={error === "invalid_email"} aria-describedby={error ? "login-error" : undefined} />
          <button type="submit" className="precision-button" disabled={sending || verifying || wait > 0 || !email.trim()}>{sendLabel}</button>
        </div>
      </div>

      <div className="grid gap-2">
        <label id="login-code-label" htmlFor="login-code" className="text-[13px]">{text("6 位验证码", "6-digit code")}</label>
        <div className={`precision-otp ${codeReady ? "" : "is-disabled"}`} onClick={() => codeRef.current?.focus()}>
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <span key={index} aria-hidden="true"
              className={`precision-otp-box ${focused && codeReady && index === activeBox ? "is-active" : ""} ${code[index] ? "is-filled" : ""}`}>{code[index] ?? ""}</span>
          ))}
          <input id="login-code" ref={codeRef} name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={OTP_LENGTH + 4}
            disabled={!codeReady || verifying} value={code} aria-labelledby="login-code-label" aria-describedby={error ? "login-error" : undefined} aria-invalid={error === "invalid_code"}
            onChange={(event) => setCode(normalizeOtp(event.target.value))}
            onFocus={(event) => { setFocused(true); const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end); }}
            onBlur={() => setFocused(false)} />
        </div>
        <p className="text-xs text-zinc-500" role="status">
          {verifying ? text("正在验证…", "Verifying…")
            : codeReady ? text(`验证码已发送至 ${sentTo}，10 分钟内有效。`, `We sent a code to ${sentTo}. It is valid for 10 minutes.`)
            : text("先发送验证码，再在这里输入。", "Send a code first, then enter it here.")}
        </p>
      </div>

      {error && <p id="login-error" role="alert" className="precision-auth-error">{errorText[error]}</p>}
      <p className="text-xs text-zinc-500 leading-relaxed">{text(
        "登录后我们会保存你的身体资料、输入的食物描述和饮食记录，用于计算营养并在多台设备间同步。你可以随时在「账号与数据」里删除。",
        "After signing in we store your body profile, the food descriptions you type and your food log to calculate nutrition and sync across devices. You can delete everything any time under Account & data.")}</p>
    </form>
  </PreviewDialog>;
}
