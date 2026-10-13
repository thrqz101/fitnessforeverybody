"use client";

import { useState } from "react";
import { PreviewDialog } from "@/components/preview/PreviewDialog";
import { usePreviewText } from "@/components/preview/PreviewChrome";

type Result = { imported: number; skippedDays: number } | null;

/** One-time offer to move this device's old local records into the signed-in account. */
export function ImportDialog({ days, foods, onImport, onSkip, onLater }: {
  days: number; foods: number;
  onImport: () => Promise<Result>; onSkip: () => Promise<boolean>; onLater: () => void;
}) {
  const text = usePreviewText();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Result>(null);
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<Result | boolean>) {
    if (busy) return;
    setBusy(true); setFailed(false);
    const result = await action();
    setBusy(false);
    if (result === false || result === null) { setFailed(true); return; }
    if (typeof result === "object") setDone(result);
  }

  return <PreviewDialog title={text("导入这台设备上的旧记录？", "Import the records saved on this device?")} onClose={onLater}>
    {done ? <div role="status" className="grid gap-4">
      <p className="text-sm text-zinc-600 leading-relaxed">{text(
        `已导入 ${done.imported} 条食物记录。历史记录只用于回看，不会计入有效识别次数，也不会改变任何一天的达标结论。`,
        `Imported ${done.imported} food records. History is for reference only: it does not add recognition counts or change any day's result.`)}</p>
      <button className="precision-button w-fit" onClick={onLater}>{text("好的", "Done")}</button>
    </div> : <div className="grid gap-4">
      <p className="text-sm text-zinc-600 leading-relaxed">{text(
        `在这台设备上找到 ${days} 天、${foods} 条已记录的食物。导入后会保存到你的账号，换设备也能看到。`,
        `Found ${foods} logged foods across ${days} days on this device. Importing saves them to your account so they follow you across devices.`)}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{text(
        "导入的历史没有当时的营养目标，所以不会被判定是否达标；重复点击不会产生重复记录。原来的本地数据会保留在这台设备上。",
        "Imported days have no goal from back then, so they are not judged. Importing twice never duplicates records, and the local copy stays on this device.")}</p>
      {failed && <p role="alert" className="precision-auth-error">{text("这次没有完成，请再试一次。", "That did not finish. Please try again.")}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="precision-button" disabled={busy} onClick={() => void run(onImport)}>{busy ? text("处理中…", "Working…") : text("导入", "Import")}</button>
        <button className="precision-button precision-button--secondary" disabled={busy} onClick={() => void run(onSkip)}>{text("不导入", "Don't import")}</button>
        <button className="precision-button precision-button--secondary" disabled={busy} onClick={onLater}>{text("稍后再说", "Ask me later")}</button>
      </div>
    </div>}
  </PreviewDialog>;
}
