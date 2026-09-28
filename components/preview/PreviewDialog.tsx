"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function PreviewDialog({ title, children, onClose, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const { language } = useI18n();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const dialog = ref.current!;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const cancel = (event: Event) => { event.preventDefault(); closeRef.current(); };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={`precision-dialog ${wide ? "precision-dialog--wide" : ""}`}>
      <header className="precision-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label={language === "en" ? "Close dialog" : "关闭窗口"}><X size={20} /></button>
      </header>
      {children}
    </dialog>
  );
}
