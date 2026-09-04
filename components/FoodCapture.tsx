"use client";

import { Camera, Check, FolderOpen, ImagePlus, Images, Keyboard, Plus, RotateCcw, Shuffle, Trash2, Upload, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { foodCatalog, type FoodCatalogItem } from "@/lib/food-catalog";
import { useI18n } from "@/lib/i18n";
import { pick, type Language } from "@/lib/i18n-utils";
import { getLocalizedFoodField, translateToEn } from "@/lib/translations";
import { macroKeys, macroLabels, scaleMacros } from "@/lib/nutrition";
import { portionOptions } from "@/lib/sample-data";
import type { FoodLogItem, MacroKey, MacroTotals } from "@/lib/types";

type FoodCaptureProps = {
  onAddFoods: (foods: FoodLogItem[]) => void;
  onBack: () => void;
};

export function FoodCapture({ onAddFoods, onBack }: FoodCaptureProps) {
  const { t, language } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [stagedFoods, setStagedFoods] = useState<FoodLogItem[]>([]);
  const [notice, setNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [manualDescription, setManualDescription] = useState("");
  const [exampleSeed, setExampleSeed] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const manualExamples = useMemo(() => buildManualExamples(exampleSeed, language), [exampleSeed, language]);
  const stagedTotals = useMemo(
    () =>
      stagedFoods.reduce<MacroTotals>(
        (total, food) => ({
          protein: total.protein + food.macros.protein,
          carbs: total.carbs + food.macros.carbs,
          fat: total.fat + food.macros.fat,
          calories: total.calories + food.macros.calories,
          fiber: total.fiber + food.macros.fiber
        }),
        { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 }
      ),
    [stagedFoods]
  );

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    showPhotoUnavailable();
    event.target.value = "";
  }

  function applyFiles(picked: File[], mode: "replace" | "append" = "replace") {
    if (!picked.length) return;
    setFiles((current) => (mode === "append" ? [...picked, ...current] : picked));
    setStagedFoods([]);
    setNotice("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    showPhotoUnavailable();
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function showPhotoUnavailable() {
    setNotice(t("拍照功能测试中，暂不可用。先用文字描述告诉我吃了什么，我来帮你估算营养素。"));
  }

  async function runAiRecognition() {
    if (manualDescription.trim().length < 6) {
      setNotice(t("先写一下你吃了什么喔，比如品牌、套餐、配菜、饮料和大概份量。"));
      return;
    }

    const unsupportedFiles = files.filter((file) => !isSupportedFile(file));
    if (unsupportedFiles.length) {
      setNotice(t("这些文件暂时不支持：{files}", { files: unsupportedFiles.map((file) => file.name).join(", ") }));
      return;
    }

    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("description", manualDescription.trim());
    form.append("lang", language);
    setIsRecognizing(true);
    setNotice(t("正在让 AI 理解你的食物描述..."));

    try {
      let aiResult = await requestFoodAi(form, language);

      if (!aiResult.ok && aiResult.retryable) {
        setNotice(t("第一次没接稳，正在自动重试一次..."));
        aiResult = await requestFoodAi(form, language);
      }

      if (!aiResult.ok || !aiResult.result?.ok) {
        setStagedFoods([]);
        setNotice(withRetryHint(aiResult.message || aiResult.result?.message || t("AI 这次没算准。"), language));
        return;
      }

      const result = aiResult.result;

      if (!result.isFoodRelated) {
        setStagedFoods([]);
        setNotice(t("我没有测出这一餐，请输入正确的食物信息。"));
        return;
      }

      setStagedFoods(result.foods ?? []);
      setNotice(result.message || t("识别好了，右边每个数字都可以继续改。"));
    } catch {
      setStagedFoods([]);
      setNotice(withRetryHint(t("AI 这次没接住。"), language));
    } finally {
      setIsRecognizing(false);
    }
  }

  function updatePortion(foodId: string, scale: number) {
    const option = portionOptions.find((item) => item.scale === scale) ?? portionOptions[1];
    setStagedFoods((current) =>
      current.map((food) =>
        food.id === foodId
          ? {
              ...food,
              portionScale: option.scale,
              portionLabel: option.label,
              macros: scaleMacros(food.baseMacros, option.scale)
            }
          : food
      )
    );
  }

  function updateMacro(foodId: string, macro: MacroKey, value: string) {
    setStagedFoods((current) =>
      current.map((food) =>
        food.id === foodId
          ? {
              ...food,
              macros: {
                ...food.macros,
                [macro]: Number(value) || 0
              }
            }
          : food
      )
    );
  }

  function updateFood(foodId: string, patch: Partial<FoodLogItem>) {
    setStagedFoods((current) => current.map((food) => (food.id === foodId ? { ...food, ...patch } : food)));
  }

  function removeFile(fileToRemove: File) {
    setFiles((current) => current.filter((file) => file !== fileToRemove));
    setStagedFoods([]);
    setNotice("");
  }

  function removeStagedFood(foodId: string) {
    setStagedFoods((current) => current.filter((food) => food.id !== foodId));
  }

  function addToLog() {
    onAddFoods(stagedFoods);
    setFiles([]);
    setStagedFoods([]);
    setManualDescription("");
  }

  async function openCamera() {
    setCameraError("");
    showPhotoUnavailable();
  }

  function stopCamera(updateState = true) {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (updateState) setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError(t("这张没有拍下来，再试一次。"));
        return;
      }
      const file = new File([blob], `camera-meal-${Date.now()}.jpg`, { type: "image/jpeg" });
      applyFiles([file], "append");
      setNotice(t("拍好了。再在右侧写一下这餐内容，我会帮你估算。"));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-[18px] border border-ink/10 bg-white/88 p-5 shadow-soft sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">AI Food Log</p>
        <h1 className="mt-1 text-3xl font-black text-ink">{t("多图拍照记录")}</h1>
        <div className="mt-4 rounded-[18px] border border-coral/25 bg-coral/10 px-3 py-2 text-sm font-bold text-coral">
          {t("拍照功能测试中，暂不可用。当前先用文字描述，写“品牌 + 套餐 + 配料 + 份量”，AI 会按文字帮你估算。")}
        </div>

        <div
          className={`mt-6 flex min-h-60 flex-col items-center justify-center rounded-[18px] border border-dashed p-6 text-center transition ${
            isDragging ? "border-coral bg-coral/10" : "border-moss/35 bg-mint/45"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
        >
          <ImagePlus className="text-moss" size={36} aria-hidden="true" />
          <span className="mt-3 text-base font-black text-ink">{t("图片导入测试中，暂不可用")}</span>
          <span className="mt-1 max-w-sm text-sm leading-6 text-ink/55">
            {t("当前版本先用文字识别。你可以在右侧参考示例，直接写今天吃了什么、点了几份、有没有主食和饮料。")}
          </span>
          <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={showPhotoUnavailable}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-white px-3 text-sm font-black text-ink/45 shadow-soft"
            >
              <FolderOpen size={16} aria-hidden="true" />
              {t("从文件选择 · 测试中")}
            </button>
            <button
              type="button"
              onClick={showPhotoUnavailable}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-white px-3 text-sm font-black text-ink/45 shadow-soft"
            >
              <Images size={16} aria-hidden="true" />
              {t("从相册选择 · 测试中")}
            </button>
            <button
              type="button"
              onClick={showPhotoUnavailable}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-moss/45 px-3 text-sm font-black text-white shadow-soft"
            >
              <Camera size={16} aria-hidden="true" />
              {t("手机拍照上传 · 测试中")}
            </button>
            <button
              type="button"
              onClick={openCamera}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-coral/55 px-3 text-sm font-black text-white shadow-soft"
            >
              <Camera size={16} aria-hidden="true" />
              {t("打开电脑摄像头 · 测试中")}
            </button>
          </div>
        </div>

        {cameraError ? (
          <div className="mt-4 rounded-[18px] border border-coral/25 bg-coral/10 px-3 py-2 text-sm font-bold text-coral">
            {cameraError}
          </div>
        ) : null}

        {cameraOpen ? (
          <div className="mt-4 rounded-[18px] border border-ink/10 bg-ink p-3 text-white">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black">{t("现场拍一张")}</p>
              <button
                type="button"
                onClick={() => stopCamera()}
                aria-label={t("关闭摄像头")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[18px] bg-white/10 text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-[18px] bg-black object-cover" />
            <button
              type="button"
              onClick={capturePhoto}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-citrus px-4 text-sm font-black text-ink"
            >
              <Camera size={17} aria-hidden="true" />
              {t("拍下这餐")}
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-[18px] border border-coral/25 bg-coral/10 px-3 py-2 text-sm font-bold text-coral">
            {notice}
          </div>
        ) : null}

        {files.length ? (
          <div className="mt-4 grid gap-2">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-[18px] border border-ink/10 bg-paper px-3 py-2 text-sm">
                <span className="truncate font-semibold text-ink">{file.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-ink/48">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    aria-label={`${t("删除")} ${file.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[18px] text-ink/50 hover:bg-white hover:text-coral"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={runAiRecognition}
            disabled={isRecognizing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-coral px-4 text-sm font-black text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-65"
          >
            <Upload size={18} aria-hidden="true" />
            {isRecognizing ? t("AI 正在解析") : t("根据描述估算")}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-ink/12 bg-white px-4 text-sm font-black text-ink"
          >
            <RotateCcw size={18} aria-hidden="true" />
            {t("返回")}
          </button>
        </div>
      </section>

      <section className="rounded-[18px] border border-ink/10 bg-white/88 p-5 shadow-soft sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Food Detail</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{t("确认识别结果")}</h2>
          </div>
          {stagedFoods.length ? (
            <button
              type="button"
              onClick={addToLog}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[18px] bg-moss px-4 text-sm font-black text-white"
            >
              <Check size={17} aria-hidden="true" />
              {t("加入今日")}
            </button>
          ) : null}
        </div>

        <section className="mb-5 rounded-[18px] border border-moss/18 bg-mint/45 p-4">
          <div className="flex items-start gap-3">
            <Keyboard className="mt-0.5 shrink-0 text-moss" size={20} aria-hidden="true" />
            <div>
              <h3 className="text-base font-black text-ink">{t("手动告诉我你今天吃了什么")}</h3>
              <p className="mt-1 text-sm leading-6 text-ink/58">
                {t("有品牌就尽量写品牌和产品名，再写套餐、主食、配菜、饮料和大概份量。")}
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-28 w-full resize-y rounded-[18px] border border-ink/12 bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-moss"
            value={manualDescription}
            onChange={(event) => setManualDescription(event.target.value)}
            placeholder={t("比如：麦当劳巨无霸套餐，一个汉堡 + 中薯 + 大可乐；或者一碗麻辣烫，里面有宽粉、牛肉丸、青菜、金针菇、豆腐皮...")}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">{t("可以这样写")}</p>
            <button
              type="button"
              onClick={() => setExampleSeed((current) => current + 1)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[18px] border border-moss/18 bg-white px-3 text-xs font-black text-moss"
            >
              <Shuffle size={14} aria-hidden="true" />
              {t("换一批示例")}
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {manualExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setManualDescription(example)}
                className="rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold leading-5 text-ink/62 transition hover:border-moss/45 hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={runAiRecognition}
            disabled={isRecognizing}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-ink px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-65"
          >
            <Upload size={17} aria-hidden="true" />
            {isRecognizing ? t("AI 正在解析") : t("让 AI 根据描述估算")}
          </button>
        </section>

        {stagedFoods.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-ink/18 bg-paper p-8 text-center">
            <Plus className="mx-auto text-ink/35" size={34} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink/58">{t("写好描述并点击“让 AI 根据描述估算”后，这里会出现可编辑的食物条目。")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-[18px] border border-moss/18 bg-mint/55 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">This Input Total</p>
                  <h3 className="mt-1 text-lg font-black text-ink">{t("本次识别合计")}</h3>
                </div>
                <p className="text-sm font-bold text-ink/58">
                  {t("共 {count} 个食物条目，编辑或删除后会自动更新。", { count: stagedFoods.length })}
                </p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {macroKeys.map((macro) => (
                  <div key={macro} className="rounded-[18px] border border-moss/12 bg-white/78 px-3 py-2">
                    <p className="text-xs font-bold text-ink/50">{t(macroLabels[macro].short)}</p>
                    <p className="mt-1 text-lg font-black text-ink">
                      {Math.round(stagedTotals[macro])}
                      <span className="ml-0.5 text-xs font-bold text-ink/45">{macroLabels[macro].unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
            {stagedFoods.map((food) => (
              <article key={food.id} className="overflow-hidden rounded-[18px] border border-ink/10 bg-paper p-4">
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeStagedFood(food.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[18px] border border-ink/12 bg-white px-2.5 text-xs font-bold text-ink/62 hover:border-coral hover:text-coral"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("删掉这个")}
                  </button>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="min-w-0">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-1.5 text-sm font-bold text-ink">
                        {t("品牌")}
                        <input
                          className="h-11 w-full min-w-0 rounded-[18px] border border-ink/12 bg-white px-3"
                          value={getLocalizedFoodField(food, "brand", language)}
                          onChange={(event) => updateFood(food.id, { brand: event.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-1.5 text-sm font-bold text-ink">
                        {t("食品类型")}
                        <input
                          className="h-11 w-full min-w-0 rounded-[18px] border border-ink/12 bg-white px-3"
                          value={getLocalizedFoodField(food, "foodType", language)}
                          onChange={(event) => updateFood(food.id, { foodType: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="mt-3 grid min-w-0 gap-1.5 text-sm font-bold text-ink">
                      {t("产品 / 食物名称")}
                      <input
                        className="h-11 w-full min-w-0 rounded-[18px] border border-ink/12 bg-white px-3"
                        value={getLocalizedFoodField(food, "name", language)}
                        onChange={(event) => updateFood(food.id, { name: event.target.value })}
                      />
                    </label>
                    <p className="mt-2 text-xs text-ink/48">{t("来源")}：{getLocalizedFoodField(food, "imageName", language) || t("AI 识别")}</p>
                    <p className="mt-1 text-xs font-bold text-moss">
                      {t(getRecognitionLabel(food))}
                    </p>
                  </div>
                  <label className="grid min-w-0 gap-1.5 text-sm font-bold text-ink">
                    {t("份量")}
                    <select
                      className="h-11 w-full min-w-0 rounded-[18px] border border-ink/12 bg-white px-3"
                      value={food.portionScale}
                      onChange={(event) => updatePortion(food.id, Number(event.target.value))}
                    >
                      {portionOptions.map((option) => (
                        <option key={option.label} value={option.scale}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-5">
                  {macroKeys.map((macro) => (
                    <label key={macro} className="grid min-w-0 gap-1.5 text-xs font-bold text-ink/70">
                      {t(macroLabels[macro].short)}
                      <input
                        className="h-10 w-full min-w-0 rounded-[18px] border border-ink/12 bg-white px-2 text-sm text-ink"
                        type="number"
                        min="0"
                        value={Math.round(food.macros[macro])}
                        onChange={(event) => updateMacro(food.id, macro, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                {getLocalizedFoodField(food, "warning", language) ? <p className="mt-3 break-words text-sm font-semibold text-coral">{getLocalizedFoodField(food, "warning", language)}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type FoodAiResult = {
  ok?: boolean;
  isFoodRelated?: boolean;
  message?: string;
  needsConfig?: boolean;
  foods?: FoodLogItem[];
};

async function requestFoodAi(form: FormData, language: Language): Promise<{
  ok: boolean;
  retryable: boolean;
  message?: string;
  result?: FoodAiResult;
}> {
  try {
    const response = await fetch("/api/food-ai", {
      method: "POST",
      body: form
    });
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    let result: FoodAiResult;

    try {
      result = await response.json();
    } catch {
      return {
        ok: false,
        retryable,
        message: retryable
          ? pick(language, "AI 第一次响应有点慢，正在再试一次。", "The AI response is a bit slow. Retrying...")
          : pick(language, "AI 返回内容有点乱，可以再点一次试试。", "The AI response was garbled. Try again.")
      };
    }

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        retryable: !result.needsConfig && retryable,
        message: result.message || (retryable
          ? pick(language, "AI 第一次没接稳，正在再试一次。", "The first attempt failed. Retrying...")
          : pick(language, "AI 这次没算准，可以再点一次试试。", "The AI couldn't calculate this time. Try again.")),
        result
      };
    }

    return { ok: true, retryable: false, result };
  } catch {
    return {
      ok: false,
      retryable: true,
      message: pick(language, "AI 第一次没接稳，正在再试一次。", "The first attempt failed. Retrying...")
    };
  }
}

function withRetryHint(message: string, language: Language) {
  const trimmed = message.trim().replace(/[。,.，\s]+$/, "");
  if (!trimmed) return pick(language, "AI 这次没接住（请再试一次）", "The AI missed that. (Please try again)");
  const suffix = pick(language, "（请再试一次）", " (try again)");
  if (language === "zh" && trimmed.endsWith("（请再试一次）")) return trimmed;
  if (language === "en" && trimmed.toLowerCase().endsWith("(try again)")) return trimmed;
  return `${trimmed}${suffix}`;
}

function isSupportedFile(file: File) {
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(name) || file.type.startsWith("image/") || file.type === "application/pdf";
}

const exampleBuckets: Array<{ name: string; match: (item: FoodCatalogItem) => boolean }> = [
  { name: "火锅", match: (item) => /火锅|海底捞|巴奴|呷哺|锅/.test(getCatalogText(item)) },
  { name: "烤肉", match: (item) => /韩式烤肉|烤肉/.test(getCatalogText(item)) },
  { name: "粉面快餐", match: (item) => /盖饭|盖浇饭|鸡腿饭|猪脚饭|黄焖鸡|粉|面|馄饨|云吞|饺子|快餐饭/.test(getCatalogText(item)) },
  { name: "麻辣烫", match: (item) => /麻辣烫|冒菜/.test(getCatalogText(item)) },
  { name: "早餐", match: (item) => /早餐|包子|馒头|胡辣汤|豆浆|油条|肠粉|热干面/.test(getCatalogText(item)) },
  { name: "西式快餐", match: (item) => /麦当劳|肯德基|汉堡王|塔斯汀|汉堡|披萨|赛百味/.test(getCatalogText(item)) },
  { name: "炒菜", match: (item) => /川菜|湘菜|粤菜|赣菜|江浙|本帮|东北|西北|小炒|炒菜/.test(getCatalogText(item)) },
  { name: "轻补", match: (item) => item.category !== "meal" || /水果|酸奶|蛋白|奶茶|咖啡|便利店/.test(getCatalogText(item)) }
];

function buildManualExamples(seed: number, language: Language) {
  const examples: string[] = [];
  const usedIds = new Set<string>();
  const bucketOffset = positiveModulo(seed, exampleBuckets.length);

  for (let step = 0; step < exampleBuckets.length && examples.length < 3; step += 1) {
    const bucket = exampleBuckets[(bucketOffset + step) % exampleBuckets.length];
    const candidates = foodCatalog.filter((item) => bucket.match(item));
    if (!candidates.length) continue;

    const item = candidates[positiveModulo(seed * 7 + step * 5, candidates.length)];
    if (usedIds.has(item.id)) continue;
    usedIds.add(item.id);
    examples.push(formatManualExample(item, bucket.name, language));
  }

  if (examples.length >= 3) return examples;

  for (const item of foodCatalog) {
    if (examples.length >= 3) break;
    if (usedIds.has(item.id)) continue;
    usedIds.add(item.id);
    examples.push(formatManualExample(item, item.foodType, language));
  }

  return examples;
}

function formatManualExample(item: FoodCatalogItem, bucketName: string, language: Language) {
  const items = item.items.slice(0, 6).map(cleanExampleItem);
  const itemText = joinList(items, language);
  const text = getCatalogText(item);
  const brand = translateToEn(item.brand);
  const title = translateToEn(item.title);
  const bucket = translateToEn(bucketName);

  if (language === "en") {
    if (/火锅|海底捞|巴奴|呷哺|锅/.test(text)) return `Today I had hot pot from ${brand}: I ordered ${title}, including ${itemText}; assume light oil and light sesame sauce, and mention rice or noodles if ordered.`;
    if (/韩式烤肉|烤肉/.test(text)) return `Today I had Korean BBQ at ${brand}: I ordered ${title}, mainly ${itemText}; add rice, cold noodles, kimchi, or drinks if included.`;
    if (/麻辣烫|冒菜/.test(text)) return `Today I had ${title} from ${brand}: roughly ${itemText}; assume normal spice, and mention sesame sauce, rice, or drinks if included.`;
    if (/盖饭|盖浇饭|鸡腿饭|猪脚饭|黄焖鸡|快餐饭/.test(text)) return `Today I had ${title} from ${brand}: served with one portion of rice and ${itemText}; mention any extra egg, meat, or drinks.`;
    if (/早餐|包子|馒头|胡辣汤|豆浆|油条|肠粉|热干面/.test(text)) return `For breakfast I had ${title} from ${brand}: it includes ${itemText}; assume a normal breakfast portion and note whether soy milk is sweetened.`;
    if (/奶茶|咖啡|茶饮|瑞幸|星巴克|喜茶|奈雪|霸王茶姬|蜜雪/.test(text)) return `Today I drank ${title} from ${brand}: configured as ${itemText}; include sugar level, milk cap, toppings, and cup size.`;
    if (/川菜|湘菜|粤菜|赣菜|江浙|本帮|东北|西北|小炒|炒菜/.test(text)) return `Today I had ${bucket} from ${brand}: I ordered ${title}, mainly ${itemText}; mention how many bowls of rice, plus any soup or drinks.`;
    return `Today I had ${title} from ${brand}: it includes ${itemText}; estimate a normal portion, and mention if it was larger or smaller.`;
  }

  if (/火锅|海底捞|巴奴|呷哺|锅/.test(text)) {
    return `今天吃了${brand}：点了${title}，里面有${itemText}；蘸料按少油少麻酱算，主食如果点了米饭或捞面也写上。`;
  }

  if (/韩式烤肉|烤肉/.test(text)) {
    return `今天吃了${brand}的烤肉：点了${title}，主要有${itemText}；如果还吃了米饭、冷面、泡菜或饮料，也一起写进去。`;
  }

  if (/麻辣烫|冒菜/.test(text)) {
    return `今天吃了${brand}的${title}：大概有${itemText}；汤底按正常辣度算，麻酱、米饭和饮料按实际有没有补充。`;
  }

  if (/盖饭|盖浇饭|鸡腿饭|猪脚饭|黄焖鸡|快餐饭/.test(text)) {
    return `今天吃了${brand}的一份${title}：主食按一份米饭算，配了${itemText}；如果加蛋、加肉或喝了饮料，也写出来。`;
  }

  if (/早餐|包子|馒头|胡辣汤|豆浆|油条|肠粉|热干面/.test(text)) {
    return `今天早餐吃了${brand}的${title}：包含${itemText}；份量按正常早餐一份算，豆浆甜不甜也可以写。`;
  }

  if (/奶茶|咖啡|茶饮|瑞幸|星巴克|喜茶|奈雪|霸王茶姬|蜜雪/.test(text)) {
    return `今天喝了${brand}的${title}：配置是${itemText}；糖度、奶盖、小料和杯型按实际写，AI 会一起估算。`;
  }

  if (/川菜|湘菜|粤菜|赣菜|江浙|本帮|东北|西北|小炒|炒菜/.test(text)) {
    return `今天吃了${brand}的${bucket}：点了${title}，主要有${itemText}；米饭几碗、有没有汤和饮料也一起告诉我。`;
  }

  return `今天吃了${brand}的${title}：大概包含${itemText}；按正常份量估算，如果份量偏大或偏小可以直接补一句。`;
}

function getCatalogText(item: FoodCatalogItem) {
  return `${item.brand} ${item.title} ${item.foodType} ${item.items.join(" ")}`;
}

function cleanExampleItem(item: string) {
  return item
    .replace(/\s*\d+(\.\d+)?\s*(g|克|ml|毫升)\b/gi, "一份")
    .replace(/\s*\d+\s*(个|块|片|杯|碗|根|份)\b/g, "几$1")
    .replace(/\s+/g, "")
    .replace(/几份$/, "几份")
    .trim();
}

function joinList(items: string[], language: Language) {
  if (!items.length) return translateToEn("常见配菜");
  if (items.length === 1) return items[0];
  const translated = items.map((item) => translateToEn(item));
  if (language === "en") return `${translated.slice(0, -1).join(", ")} and ${translated[translated.length - 1]}`;
  return `${translated.slice(0, -1).join("、")}和${translated[translated.length - 1]}`;
}

function getRecognitionLabel(food: FoodLogItem) {
  const brand = food.brand?.trim() ?? "";
  const hasRecognizedBrand = Boolean(brand) && !/未识别|未知|无品牌|行业平均|同品类平均|餐饮行业平均/.test(brand);

  if (food.recognitionMode === "industry-average") {
    return hasRecognizedBrand
      ? "已识别品牌，未查到官方营养表，按公开资料或同品类份量估算"
      : "未识别出明确品牌，已用同品类份量估算";
  }

  return hasRecognizedBrand ? "按品牌 + 产品组合估算" : "已识别食物，按同品类份量估算";
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
