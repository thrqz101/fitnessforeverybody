"use client";

import { Trash2 } from "lucide-react";
import { Dialog } from "@/shared/ui/Dialog";
import { useText } from "@/shared/i18n/i18n";

export type DeleteRequest =
  | { kind: "one"; id: string; name: string; counted: boolean }
  | { kind: "drafts"; count: number }
  | { kind: "all"; count: number };

/** Asks before any food record is deleted; deletions of counted foods cannot be undone. */
export function DeleteConfirmDialog({ request, onConfirm, onClose }: {
  request: DeleteRequest; onConfirm: () => void; onClose: () => void;
}) {
  const text = useText();
  let title: string;
  let message: string;
  switch (request.kind) {
    case "one":
      title = text("删除这条记录？", "Delete this record?");
      message = request.counted
        ? text(`“${request.name}”已计入今天，删除后今日营养进度会同步减少，且无法恢复。`, `“${request.name}” is counted in today. Deleting it lowers today's progress and cannot be undone.`)
        : text(`“${request.name}”还在待确认中，删除后不会计入今天。`, `“${request.name}” has not been counted yet. It will not be added to today.`);
      break;
    case "drafts":
      title = text("清空待确认？", "Clear unconfirmed foods?");
      message = text(`将删除 ${request.count} 条还没计入今天的记录。`, `This deletes ${request.count} foods that have not been counted yet.`);
      break;
    case "all":
      title = text("清空今天全部记录？", "Clear all of today's records?");
      message = text(`将删除今天的 ${request.count} 条记录，包括已计入的食物，今日营养进度会归零，且无法恢复。`, `This deletes all ${request.count} records of today, including counted foods. Today's progress resets to zero and this cannot be undone.`);
      break;
    default: {
      const unhandled: never = request;
      throw new Error(`Unhandled delete request ${JSON.stringify(unhandled)}`);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-zinc-600">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="precision-button precision-button--secondary" onClick={onClose} autoFocus>{text("取消", "Cancel")}</button>
        <button type="button" className="precision-button !bg-red-700 hover:!bg-red-800" onClick={() => { onConfirm(); onClose(); }}>
          <Trash2 size={16} aria-hidden="true" />{request.kind === "one" ? text("删除", "Delete") : text("清空", "Clear")}
        </button>
      </div>
    </Dialog>
  );
}
