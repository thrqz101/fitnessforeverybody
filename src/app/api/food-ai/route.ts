import { streamRecognition } from "@/features/recognition/domain/events";
import { getProviderConfig, requestChatCompletion, buildChatCompletionBody, warmupAiTimeoutMs, buildAiServiceErrorResponse } from "@/features/recognition/server/llm-client";
import { recognizeFood } from "@/features/recognition/server/recognize";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const provider = getProviderConfig();
  if (!provider) {
    return Response.json(
      { ok: false, needsConfig: true, message: "AI 服务还没配置好。" },
      { status: 503 }
    );
  }

  const { response, errorText } = await requestChatCompletion(
    provider,
    buildChatCompletionBody(provider, 24, [
      {
        role: "system",
        content: "只返回 JSON。"
      },
      {
        role: "user",
        content: '返回 {"ok":true}'
      }
    ]),
    warmupAiTimeoutMs
  );

  if (!response?.ok) return buildAiServiceErrorResponse(response, errorText);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    return streamRecognition((report, signal) => recognizeFood(request, report, signal), request.signal);
  }
  return recognizeFood(request, undefined, request.signal);
}
