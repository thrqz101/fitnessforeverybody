# Errors

Read this guide when changing application error behaviour. Read [ui](ui.md) for user-facing placement and [AGENTS.md](../AGENTS.md) for logging and production-safety constraints.

## Choose the boundary

- Validation failure: reject the input at the API route (`shared/api/validate.ts`, `badRequest()`) and attach feedback to the field or operation the user can correct.
- Expected domain failure: represent it with a stable typed error code when callers need distinct product behaviour. Database functions raise named exceptions; `shared/api/errors.ts` maps them to an HTTP status and a stable `code` such as `version_conflict`, `day_closed` or `entry_deleted`.
- Infrastructure or integration failure: translate it at the owning adapter. LLM failures become user-facing copy in `recognition/server/llm-client.ts`; database failures become `backend_error`. Do not leak database queries, provider responses, credentials, or internal stack details to the browser.
- Broken invariant or unexpected system failure: throw a normal `Error`, return generic user-facing copy, and add structured operational context only when the path needs investigation.

Do not catch an error merely to discard it or return a plausible success value. A recognition result is reported only after it is stored; a failed save must never look like success.

## Codes and metadata

Add a stable error code only when the product, caller, or monitoring behaviour needs a distinct classification. Error metadata may reach logs or browser developer tools. Include only stable identifiers and operation context needed to investigate the failure. Never include secrets, credentials, meal descriptions beyond what the user just sent, unnecessary personal data, or full provider payloads.

## Retries

Retry only idempotent operations. Recognition is idempotent by `requestId`: a retry with the same id replays the stored result, and the same id with different text is refused with `request_conflict`. LLM requests retry across provider endpoints inside `requestChatCompletion`; callers do not add another retry loop.

## Frontend handling

Show an actionable message at the narrowest surface that owns recovery. Do not display raw thrown messages from server or infrastructure code. `shared/api/client.ts` maps recognised codes to reviewed copy (`describeCloudError`) and uses a generic message for unexpected failures.
