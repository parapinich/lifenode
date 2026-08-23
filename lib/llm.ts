import { GoogleGenAI, ApiError } from '@google/genai'
import { z } from 'zod'

export const MODEL = 'gemini-3.6-flash'
const MAX_ATTEMPT = 2

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export class LLMError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function callStructuredLLM<T>(
  system: string,
  userMessage: string,
  schema: z.ZodType<T>
): Promise<T> {
  let extra = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
    let text: string | undefined
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: userMessage + extra,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
        },
      })
      text = response.text
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401 || e.status === 403) throw new LLMError('GEMINI_API_KEY is invalid or missing', 500)
        if (e.status === 429) throw new LLMError('Rate limited by Gemini API, try again shortly', 429)
        throw new LLMError(`Gemini API error: ${e.message}`, 502)
      }
      throw e
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
