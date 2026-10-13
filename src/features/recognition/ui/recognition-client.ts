import type { RecognitionEvent, RecognitionResult, RecognitionStep, ProgressReporter } from '../domain/events';
import type { Language } from '@/shared/i18n/i18n-utils';

export type RecognitionRequestOptions = { onProgress?: ProgressReporter; signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number };
export type RecognitionResponse = { ok: boolean; retryable: boolean; message?: string; result?: RecognitionResult };

function progressStep(value: unknown): RecognitionStep | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const step = value as RecognitionStep;
  if (typeof step.id !== 'string' || typeof step.labelZh !== 'string' || typeof step.labelEn !== 'string'
    || !['active','complete','warning','error'].includes(step.status)) return undefined;
  return { id: step.id.slice(0, 40), status: step.status, labelZh: step.labelZh.slice(0, 250), labelEn: step.labelEn.slice(0, 250) };
}

export async function readRecognitionResponse(response: Response, onProgress?: ProgressReporter): Promise<{ status: number; result: RecognitionResult }> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return { status: response.status, result: await response.json() };
  }
  if (!response.body) throw new Error('Missing response stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal: { status: number; result: RecognitionResult } | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    if (line.length > 250_000) throw new Error('Recognition event too large');
    const event = JSON.parse(line) as RecognitionEvent;
    if (event.type === 'progress') {
      const step = progressStep(event.step);
      if (step && !terminal) onProgress?.(step);
    } else if (event.type === 'result') {
      if (terminal || !event.result || typeof event.result.ok !== 'boolean'
        || !Number.isInteger(event.status) || event.status < 200 || event.status > 599) throw new Error('Invalid terminal result');
      terminal = { status: event.status, result: event.result };
    }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 250_000) throw new Error('Recognition stream buffer too large');
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
      }
      if (done) { consume(buffer); break; }
    }
    if (!terminal) throw new Error('Recognition stream ended without a result');
    return terminal;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}

const codeMessages: Record<string, [string, string]> = {
  unauthenticated: ['登录已过期，请重新登录。', 'Your session has expired. Please sign in again.'],
  rate_limited: ['识别太频繁，请稍后再试。', 'Too many recognitions. Please try again shortly.'],
  invalid_input: ['提交的内容不符合要求，请检查后重试。', 'Some of the input is not valid. Please check and try again.'],
  backend_unconfigured: ['云端服务暂不可用。', 'The cloud service is unavailable right now.']
};
function codeMessage(code: string, language: Language) {
  const pair = codeMessages[code];
  return pair ? (language === 'en' ? pair[1] : pair[0]) : undefined;
}

export async function requestFoodAi(form: FormData, language: Language, options: RecognitionRequestOptions = {}): Promise<RecognitionResponse> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 120_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
  const fallback = language === 'en' ? 'Recognition could not finish. Please try again.' : '识别暂未完成，请再试一次。';
  // One id per FormData: automatic retries reuse it, so the server never creates a second recognition.
  if (!form.has('requestId')) form.append('requestId', crypto.randomUUID());
  try {
    const response = await (options.fetcher ?? fetch)('/api/food-ai', {
      method: 'POST', headers: { Accept: 'application/x-ndjson' }, body: form, signal
    });
    options.onProgress?.({ id: 'request', status: 'complete', labelZh: '已连接识别服务', labelEn: 'Connected to recognition service' });
    const { status, result } = await readRecognitionResponse(response, options.onProgress);
    const ok = status >= 200 && status < 300 && result.ok === true;
    const hasFoods = ok && result.isFoodRelated === true && Boolean(result.foods?.length);
    options.onProgress?.({ id: 'result', status: hasFoods ? 'complete' : ok ? 'warning' : 'error',
      labelZh: hasFoods ? '识别完成，结果已准备好' : ok ? '需要补充具体的食物信息' : '识别暂未完成，请重试',
      labelEn: hasFoods ? 'Recognition complete. Results are ready.' : ok ? 'Please provide more specific food information.' : 'Recognition could not finish. Please retry.' });
    const coded = !result.message && result.code ? codeMessage(result.code, language) : undefined;
    return { ok, retryable: !result.needsConfig && result.code !== 'unauthenticated' && (status === 408 || status === 429 || status >= 500), result, message: result.message || coded || (ok ? undefined : fallback) };
  } catch {
    options.onProgress?.({ id: 'result', status: 'error', labelZh: timeout.signal.aborted ? '等待超时，请重试' : '连接已中断，请重试', labelEn: timeout.signal.aborted ? 'Request timed out. Please retry.' : 'Connection interrupted. Please retry.' });
    return { ok: false, retryable: !options.signal?.aborted, message: fallback };
  } finally { clearTimeout(timer); }
}
