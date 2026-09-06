import { z } from 'zod'

export const MODEL = 'openai/gpt-oss-120b'
const MAX_ATTEMPT = 2
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export class LLMError extends Error {
  status: number
  retryAfter?: number
  constructor(message: string, status: number, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

// Groq sends `retry-after` in whole seconds; `x-ratelimit-reset-tokens` is
// finer ("45.269s") and is the one that actually moves when TPM is the limit.
function resetSeconds(headers: Headers): number | undefined {
  const seconds = Number(headers.get('retry-after')) || Number(headers.get('x-ratelimit-reset-tokens')?.replace(/s$/, ''))
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined
}

// Every route reports LLM failures the same way: keep the upstream status (so a
// 429 stays retryable instead of looking fatal) and pass the wait along.
export function llmErrorBody(e: unknown, fallback: string) {
  const llm = e instanceof LLMError ? e : null
  return {
    body: { error: llm?.message ?? (e instanceof Error ? e.message : fallback), retryAfter: llm?.retryAfter },
    status: llm?.status ?? 502,
  }
}

export async function callStructuredLLM<T>(
  system: string,
  userMessage: string,
  schema: z.ZodType<T>
): Promise<T> {
  // Groq's json_object mode only guarantees valid JSON, not a matching shape
  // (unlike Gemini's responseJsonSchema) — spell out the schema in-prompt so
  // the model has something to conform to.
  const schemaHint = `\n\nOutput schema (JSON Schema):\n${JSON.stringify(z.toJSONSchema(schema))}`
  let extra = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
    let text: string | undefined
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMessage + schemaHint + extra },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new LLMError('GROQ_API_KEY is invalid or missing', 500)
        if (res.status === 429) throw new LLMError('Rate limited by Groq API', 429, resetSeconds(res.headers))
        const body = await res.text().catch(() => '')
        throw new LLMError(`Groq API error (${res.status}): ${body}`, 502)
      }
      const data = await res.json()
      text = data.choices?.[0]?.message?.content
    } catch (e) {
      if (e instanceof LLMError) throw e
      throw new LLMError(`Groq API error: ${e instanceof Error ? e.message : String(e)}`, 502)
    }

    if (text) {
      try {
        return schema.parse(JSON.parse(text))
      } catch (e) {
        if (attempt < MAX_ATTEMPT) {
          const detail = e instanceof z.ZodError ? JSON.stringify(e.issues) : String(e)
          extra = `\n\nThe previous output did not match the required schema: ${detail}\nFix it and return again — output must be JSON matching the schema only.`
          continue
        }
      }
    }
  }
  throw new LLMError('LLM failed to return valid output after retry', 502)
}
