import type { FoodLogItem } from './types';

export type RecognitionStep = {
  id: string;
  status: 'active' | 'complete' | 'warning' | 'error';
  labelZh: string;
  labelEn: string;
};

export type RecognitionResult = {
  ok?: boolean;
  isFoodRelated?: boolean;
  message?: string;
  needsConfig?: boolean;
  provider?: string;
  foods?: FoodLogItem[];
};

export type RecognitionEvent =
  | { type: 'progress'; step: RecognitionStep }
  | { type: 'result'; status: number; result: RecognitionResult };

export type ProgressReporter = (step: RecognitionStep) => void;

export function updateRecognitionSteps(current: RecognitionStep[], step: RecognitionStep): RecognitionStep[] {
  const acknowledged = step.id === 'input'
    ? current.map(row => row.id === 'request' && row.status === 'active'
      ? { ...row, status: 'complete' as const, labelZh: '已连接识别服务', labelEn: 'Connected to recognition service' }
      : row)
    : current;
  const settled = step.id === 'result' ? acknowledged.map(row => row.status === 'active'
    ? { ...row, status: 'warning' as const, labelZh: `此步骤未完成：${row.labelZh.replace(/^正在/, '')}`, labelEn: `Step unfinished: ${row.labelEn}` }
    : row) : acknowledged;
  const index = settled.findIndex(row => row.id === step.id);
  if (index < 0) return [...settled, step].slice(-12);
  return settled.map((row, i) => i === index ? step : row);
}

/** Opt-in streaming keeps the ordinary JSON API and its HTTP status codes intact. */
export function streamRecognition(
  run: (report: ProgressReporter, signal: AbortSignal) => Promise<Response>,
  parentSignal: AbortSignal
): Response {
  const abort = new AbortController();
  const signal = AbortSignal.any([parentSignal, abort.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RecognitionEvent) => {
        if (!closed && !signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };
      try {
        const response = await run(step => send({ type: 'progress', step }), signal);
        if (!signal.aborted) send({ type: 'result', status: response.status, result: await response.json() });
      } catch {
        send({ type: 'progress', step: { id: 'result', status: 'error', labelZh: '识别暂未完成，请重试', labelEn: 'Recognition could not finish. Please retry.' } });
        send({ type: 'result', status: 502, result: { ok: false } });
      } finally {
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; abort.abort(); }
  });
  return new Response(stream, { headers: {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no'
  } });
}
