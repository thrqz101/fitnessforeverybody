"use client";

import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cloudApi, describeCloudError } from "@/shared/api/client";
import { useI18n, useText } from "@/shared/i18n/i18n";

/** What is stored, sign-out everywhere, and permanent account deletion (confirmed by typing the email). */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const text = useText();
  const { language } = useI18n();
  const auth = useAuth();
  const email = auth.user?.email ?? "";
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"revoke" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matches = email !== "" && typed.trim().toLowerCase() === email.toLowerCase();

  async function revokeAll() {
    if (busy) return;
    setBusy("revoke"); setError(null);
    try { await auth.signOut("global"); onClose(); } catch { setError(text("操作未完成，请再试一次。", "That did not finish. Please try again.")); setBusy(null); }
  }

  async function deleteAccount() {
    if (busy || !matches) return;
    setBusy("delete"); setError(null);
    try {
      await cloudApi.deleteAccount(typed.trim());
      await auth.signOut("local");
      setMessage(text("账号和全部数据已删除。", "Your account and all data have been deleted."));
      onClose();
    } catch (failure) {
      setError(describeCloudError(failure, language));
      setBusy(null);
    }
  }

  return <Dialog title={text("账号与数据", "Account & data")} onClose={onClose}>
    <div className="grid gap-5 text-sm text-zinc-600 leading-relaxed">
      <section aria-labelledby="account-stored">
        <h3 id="account-stored" className="font-medium text-zinc-900 mb-1">{text("我们保存什么", "What we store")}</h3>
        <p>{text(
          "你登录用的邮箱、身体资料和训练/饮食设置、你输入的食物描述及识别结果、已记录的饮食、每天的营养目标与达标结果，以及你提交的反馈。这些用来计算营养、跨设备同步和改进产品，不会公开展示。",
          "Your sign-in email, body profile and training/diet settings, the food descriptions you type and their results, your food log, daily targets and results, and any feedback you send. They are used to calculate nutrition, sync across devices and improve the product, and are never shown publicly.")}</p>
        <p className="mt-2 text-xs text-zinc-500">{text(`当前账号：${email}`, `Signed in as ${email}`)}</p>
      </section>
      <section aria-labelledby="account-sessions">
        <h3 id="account-sessions" className="font-medium text-zinc-900 mb-1">{text("登录状态", "Sessions")}</h3>
        <p>{text("退出所有设备会让这个账号在每台设备上都需要重新登录。", "Signing out everywhere makes every device sign in again.")}</p>
        <button type="button" className="precision-button precision-button--secondary mt-3" disabled={busy !== null} onClick={() => void revokeAll()}>
          {busy === "revoke" ? text("处理中…", "Working…") : text("退出所有设备", "Sign out everywhere")}
        </button>
      </section>
      <section aria-labelledby="account-delete" className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
        <h3 id="account-delete" className="font-medium text-red-900 mb-1">{text("删除账号和全部数据", "Delete account and all data")}</h3>
        <p className="text-red-900/80">{text("会永久删除上面列出的全部内容，无法恢复。", "This permanently deletes everything listed above and cannot be undone.")}</p>
        <label className="grid gap-2 mt-3 text-xs">{text("输入你的邮箱以确认", "Type your email to confirm")}
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" placeholder={email}
            className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900" />
        </label>
        <button type="button" className="precision-button mt-3 !bg-red-700 hover:!bg-red-800" disabled={!matches || busy !== null} onClick={() => void deleteAccount()}>
          {busy === "delete" ? text("删除中…", "Deleting…") : text("永久删除", "Delete permanently")}
        </button>
      </section>
      {error && <p role="alert" className="precision-auth-error">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </Dialog>;
}
