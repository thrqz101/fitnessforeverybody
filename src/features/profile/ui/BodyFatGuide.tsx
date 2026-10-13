"use client";

import { useI18n } from "@/shared/i18n/i18n";
import { Maximize2, X } from "lucide-react";
import { useState } from "react";
import { bodyFatPhotoRefs, bodyFatRanges, type BodyFatPhotoRef } from "@/features/profile/domain/options";

export function BodyFatPhoto({
  photo,
  onExpand
}: {
  photo: BodyFatPhotoRef;
  onExpand: () => void;
}) {
  const { t } = useI18n();
  return (
    <article className="overflow-hidden rounded-[18px] border border-ink/10 bg-paper">
      <button
        type="button"
        onClick={onExpand}
        aria-label={`${t("放大查看")}${t(photo.title)}`}
        className="group relative block w-full cursor-zoom-in bg-white"
      >
        <img src={photo.src} alt={t(photo.title)} className="h-full max-h-[64vh] w-full object-contain" loading="lazy" />
        <span className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-ink/10 bg-white/90 text-moss shadow-soft transition group-hover:scale-105">
          <Maximize2 size={18} aria-hidden="true" />
        </span>
      </button>
      <div className="p-3">
        <p className="text-sm font-black text-ink">{t(photo.title)}</p>
        <p className="mt-1 text-xs font-bold text-coral">{photo.range}</p>
        <p className="mt-2 text-xs font-semibold text-ink/48">{t(photo.credit)}</p>
      </div>
    </article>
  );
}

export function BodyFatColumn({ title, rows }: { title: string; rows: string[][] }) {
  const { t } = useI18n();
  return (
    <div className="rounded-[18px] border border-ink/10 bg-paper p-4">
      <h3 className="text-lg font-black text-ink">{t(title)}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map(([range, label, detail], index) => (
          <div key={range} className="grid gap-2 rounded-[18px] border border-ink/8 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-ink">{range}</p>
              <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-black text-moss">{t(label)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/10">
              <div className="h-2 rounded-full bg-coral" style={{ width: `${24 + index * 16}%` }} />
            </div>
            <p className="text-sm leading-5 text-ink/58">{t(detail)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Body fat reference dialog with its own full-screen photo preview. */
export function BodyFatGuideDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [expandedBodyFat, setExpandedBodyFat] = useState<BodyFatPhotoRef | null>(null);
  return (
    <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 backdrop-blur-sm">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[18px] border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Body Fat Guide</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{t("体脂率评判标准图")}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/58">{t("用真人体脂对照图做视觉参考，再配合区间判断目标。不同身高、骨架和肌肉量会让观感有差异。")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("关闭体脂率参考")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-ink/12 bg-paper text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {bodyFatPhotoRefs.map((photo) => (
            <BodyFatPhoto key={photo.src} photo={photo} onExpand={() => setExpandedBodyFat(photo)} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BodyFatColumn title="男生参考" rows={bodyFatRanges.male} />
          <BodyFatColumn title="女生参考" rows={bodyFatRanges.female} />
        </div>
        <p className="mt-4 text-xs leading-5 text-ink/48">
          {t("说明：体脂率视觉参考仅用于自我估算，不作为医学诊断；同样体脂率在不同肌肉量、骨架和水分状态下会有明显观感差异。")}
        </p>
      </section>
    </div>
      {expandedBodyFat ? (
      <div className="fixed inset-0 z-[60] bg-ink/78 p-3 backdrop-blur-sm sm:p-6">
        <section className="flex h-full flex-col rounded-[18px] border border-white/18 bg-white shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Body Fat Guide</p>
              <h3 className="text-lg font-black text-ink">{t(expandedBodyFat.title)}</h3>
            </div>
            <button
              type="button"
              onClick={() => setExpandedBodyFat(null)}
              aria-label={t("关闭放大图")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-ink/12 bg-paper text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-paper p-3 sm:p-5">
            <img
              src={expandedBodyFat.src}
              alt={`${t(expandedBodyFat.title)} ${t("放大图")}`}
              className="mx-auto h-auto w-full max-w-6xl rounded-[18px] bg-white object-contain shadow-soft"
            />
          </div>
        </section>
      </div>
      ) : null}
    </>
  );
}
