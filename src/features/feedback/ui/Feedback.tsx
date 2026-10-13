"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cloudApi, describeCloudError } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n";
import { Dialog } from "@/shared/ui/Dialog";

export function Feedback({ invitation, onClose }: {
  invitation: number | null;
  onClose: () => void;
}) {
  const { language } = useI18n();
  const text = (zh: string, en: string) => language === "en" ? en : zh;
  const auth = useAuth();
  // With a backend the feedback is really stored; without one this stays a clearly labelled demo.
  const live = auth.status === "signed_in";
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per opened dialog: a retry or double click can never create a second row.
  const dedupeId = useRef(crypto.randomUUID());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") ?? "").trim();
    if (message.length < 2) return;
    if (!live) { setSubmitted(true); return; }
    setBusy(true);
    setError(null);
    try {
      await cloudApi.submitFeedback({
        dedupeId: dedupeId.current, kind: String(form.get("kind") ?? "suggestion"), message, contact: String(form.get("contact") ?? "")
      });
      setSubmitted(true);
    } catch (failure) {
      setError(describeCloudError(failure, language));
    } finally {
      setBusy(false);
    }
  }

  return <Dialog title={text("告诉我们你的真实体验", "Tell us about your experience")} onClose={onClose}>
    <p className="text-sm text-zinc-500 leading-relaxed mb-6">
      {invitation
        ? text(`你已经完成 ${invitation} 次识别与录入。这段时间用得怎么样？欢迎告诉我们，也可以稍后再说。`, `You've completed ${invitation} food recognition and logging flows. How has it been? We'd love your feedback, whenever you're ready.`)
        : text("哪里好用，哪里不顺手？你的反馈会帮助我们改进。", "What works well, and what could be easier? Your feedback helps us improve.")}
    </p>
    <p className="text-xs text-zinc-500 mb-5">{live
      ? text("反馈只有你和我们能看到，不会公开展示。联系方式选填。", "Only you and we can see your feedback; it is never shown publicly. Contact details are optional.")
      : text("反馈功能演示：内容暂不会发送或保存。", "Feedback demo: your message is not sent or saved.")}</p>
    {submitted ? <div role="status" className="py-8 text-center">
      <Check className="mx-auto mb-4 text-moss" />
      <p>{live ? text("已收到，谢谢你的反馈。", "Received. Thank you for your feedback.") : text("演示完成，反馈未发送。", "Demo complete. Your feedback was not sent.")}</p>
      <button className="precision-button mt-6" onClick={onClose}>{text("关闭", "Close")}</button>
    </div> : <form className="precision-feedback-form" onSubmit={submit}>
      <label>{text("反馈类型", "Feedback type")}<select name="kind" defaultValue="suggestion">
        <option value="suggestion">{text("功能建议", "Suggestion")}</option>
        <option value="issue">{text("遇到问题", "Issue")}</option>
        <option value="other">{text("其他反馈", "Other feedback")}</option>
      </select></label>
      <label>{text("反馈内容", "Your feedback")}<textarea name="message" required minLength={2} maxLength={2000} rows={5}
        placeholder={text("分享你的实际使用感受…", "Share your experience…")}
        onChange={(event) => event.currentTarget.setCustomValidity(event.currentTarget.value.trim().length < 2 ? text("请填写至少两个有效字符", "Please enter at least two non-space characters") : "")} /></label>
      <label>{text("联系方式（可选）", "Contact details (optional)")}<input name="contact" maxLength={150} autoComplete="off" placeholder={text("邮箱或其他联系方式", "Email or another way to reach you")} /></label>
      {error && <p role="alert" className="precision-auth-error">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="precision-button" type="submit" disabled={busy}><ArrowRight size={16} />{live ? (busy ? text("提交中…", "Sending…") : text("提交反馈", "Send feedback")) : text("预览提交", "Preview submission")}</button>
        <button className="precision-button precision-button--secondary" type="button" onClick={onClose}>{text("稍后再说", "Maybe later")}</button>
      </div>
    </form>}
  </Dialog>;
}
