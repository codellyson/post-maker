import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

// One small interface so the writer does not care which provider runs it.
// Anthropic is the default; another provider plugs in by implementing `json`.
export type AiPart = { type: 'text'; text: string } | { type: 'image'; data: ArrayBuffer; mime?: 'image/png' | 'image/jpeg' | 'image/webp' }
export type AiRequest<T extends z.ZodType> = {
  schema: T
  system: string // stable per product: cached
  parts: AiPart[] // the volatile request: text and images
  effort?: 'low' | 'medium' | 'high'
  signal?: AbortSignal // cancels the request mid-way, so a stopped job stops being billed
}
export type AiProvider = { json<T extends z.ZodType>(req: AiRequest<T>): Promise<z.infer<T>> }

const toB64 = (b: ArrayBuffer) => {
  let s = ''
  const bytes = new Uint8Array(b)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function anthropic(env: Env): AiProvider {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set. Locally, add it to .dev.vars; live, run: wrangler secret put ANTHROPIC_API_KEY')
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const model = env.AI_MODEL || 'claude-opus-5-5'
  return {
    async json(req) {
      const content: Anthropic.ContentBlockParam[] = req.parts.map(p => p.type === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'image', source: { type: 'base64', media_type: p.mime ?? 'image/png', data: toB64(p.data) } })
      // Streamed so a large max_tokens does not hit the non-streaming timeout.
      const res = await client.messages.stream({
        model,
        max_tokens: 64000,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: req.effort ?? 'high', format: zodOutputFormat(req.schema) },
        messages: [{ role: 'user', content }],
      }, { signal: req.signal }).finalMessage()
      if (res.stop_reason === 'refusal') throw new Error(`The AI declined this request (${res.stop_details?.category ?? 'no reason given'}).`)
      if (res.stop_reason === 'max_tokens') throw new Error('The AI ran out of room before finishing. Try again.')
      if (!res.parsed_output) throw new Error('The AI returned something that did not match the expected shape.')
      return res.parsed_output
    },
  }
}

export function aiFor(env: Env): AiProvider {
  const provider = (env.AI_PROVIDER || 'anthropic').toLowerCase()
  if (provider === 'anthropic') return anthropic(env)
  throw new Error(`AI_PROVIDER "${provider}" is not supported yet. Supported: anthropic.`)
}
