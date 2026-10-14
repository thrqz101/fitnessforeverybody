"use client";

import { useCallback, useEffect, useRef } from "react";
import { previewFoodRoute, type RoutePreviewResult } from "./recognition-client";

const debounceMs = 500;
const maxWaitMs = 2500;

type Preview = { description: string; controller: AbortController; result: Promise<RoutePreviewResult> };

/**
 * Asks for the recognition route shortly after the user stops typing. Returns a lookup that recognition
 * calls on submit: it reuses the answer for the same text, waits briefly for one still in flight, and
 * otherwise returns null so the server decides the route itself.
 */
export function useRoutePreview(text: string) {
  const latest = useRef<Preview | null>(null);

  useEffect(() => {
    const description = text.trim();
    if (description.length < 2 || latest.current?.description === description) return;
    const timer = window.setTimeout(() => {
      latest.current?.controller.abort();
      const controller = new AbortController();
      latest.current = { description, controller, result: previewFoodRoute(description, controller.signal) };
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => () => latest.current?.controller.abort(), []);

  return useCallback(async (description: string): Promise<RoutePreviewResult> => {
    const preview = latest.current;
    if (!preview || preview.description !== description) return null;
    const timeout = new Promise<RoutePreviewResult>((resolve) => window.setTimeout(() => resolve(null), maxWaitMs));
    return Promise.race([preview.result, timeout]);
  }, []);
}
