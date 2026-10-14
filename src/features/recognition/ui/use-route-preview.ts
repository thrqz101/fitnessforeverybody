"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Language } from "@/shared/i18n/i18n-utils";
import { previewFoodRoute, type RoutePreviewResult } from "./recognition-client";

const debounceMs = 500;
const maxWaitMs = 2500;

type Preview = { description: string; language: Language; controller: AbortController; result: Promise<RoutePreviewResult> };

/**
 * Asks for the recognition route shortly after the user stops typing. Returns a lookup that recognition
 * calls on submit: it reuses the answer for the same text or starts one now, waits up to 2.5 s for it, and
 * otherwise returns null so the server decides the route itself.
 */
export function useRoutePreview(text: string, language: Language) {
  const latest = useRef<Preview | null>(null);

  // Reuses the preview for this text and language, so the debounce and a submit never cancel each other.
  const previewFor = useCallback((description: string, language: Language) => {
    const current = latest.current;
    if (current && current.description === description && current.language === language) return current;
    current?.controller.abort();
    const controller = new AbortController();
    const preview = { description, language, controller, result: previewFoodRoute(description, language, controller.signal) };
    latest.current = preview;
    return preview;
  }, []);

  useEffect(() => {
    const description = text.trim();
    if (description.length < 2) return;
    const timer = window.setTimeout(() => previewFor(description, language), debounceMs);
    return () => window.clearTimeout(timer);
  }, [text, language, previewFor]);

  useEffect(() => () => latest.current?.controller.abort(), []);

  return useCallback(async (description: string): Promise<RoutePreviewResult> => {
    // Submitting before the debounce fired still gets a preview, so rejections never depend on typing speed.
    const preview = previewFor(description, language);
    const timeout = new Promise<RoutePreviewResult>((resolve) => window.setTimeout(() => resolve(null), maxWaitMs));
    return Promise.race([preview.result, timeout]);
  }, [language, previewFor]);
}
