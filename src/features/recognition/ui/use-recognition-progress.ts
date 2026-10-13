'use client';
import { useEffect, useRef, useState } from 'react';
import { updateRecognitionSteps, type RecognitionStep } from '@/features/recognition/domain/events';

export function useRecognitionProgress() {
  const [steps, setSteps] = useState<RecognitionStep[]>([]);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  function begin(retry = false) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const queued: RecognitionStep = { id: 'request', status: 'active', labelZh: retry ? '正在重试识别服务…' : '正在连接识别服务…', labelEn: retry ? 'Retrying recognition service…' : 'Connecting to recognition service…' };
    setSteps(retry ? [{ id: 'retry', status: 'complete', labelZh: '首次连接未完成，已发起一次重试', labelEn: 'The first connection failed. One retry started.' }, queued] : [queued]);
    return {
      signal: controller.signal,
      onProgress: (step: RecognitionStep) => {
        if (active.current !== controller || controller.signal.aborted) return;
        setSteps(rows => updateRecognitionSteps(rows, step));
      }
    };
  }
  return { steps, begin };
}
