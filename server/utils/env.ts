/// <reference types="@cloudflare/workers-types" />
import type { H3Event } from 'h3'

export type JobMessage = { jobId: string }

export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  BROWSER: Fetcher
  JOBS: Queue<JobMessage>
  EMAIL?: { send: (m: { from: string; to: string; subject: string; text: string; html: string }) => Promise<unknown> }
  MAIL_FROM?: string
  SIGNIN_LIMIT?: { limit: (o: { key: string }) => Promise<{ success: boolean }> }
  AI_PROVIDER?: string
  AI_MODEL?: string
  ANTHROPIC_API_KEY?: string
  CRED_KEY?: string
  DEV_SHOW_CODE?: string
}

export type User = { id: string; email: string; tokenHash: string; workspaceId: string; role: 'owner' | 'member' }

export const envOf = (event: H3Event) => event.context.cloudflare.env as Env
export const userOf = (event: H3Event) => event.context.user as User

const ID = /^[a-z0-9]{6,16}$/
export function validId(id: unknown, what = 'id'): string {
  if (typeof id !== 'string' || !ID.test(id)) throw createError({ statusCode: 400, statusMessage: `Bad ${what}.` })
  return id
}

export async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')
export const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0')
export const newId = () => [...crypto.getRandomValues(new Uint8Array(10))].map(b => (b % 36).toString(36)).join('')
export const isLocal = (event: H3Event) => ['localhost', '127.0.0.1'].includes(getRequestURL(event).hostname)

// Read a JSON body, refusing anything over `max` bytes before parsing it.
export async function body<T>(event: H3Event, max = 64_000): Promise<T> {
  const raw = await readRawBody(event, 'utf8')
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'Missing body.' })
  if (raw.length > max) throw createError({ statusCode: 413, statusMessage: 'Too large.' })
  try {
    return JSON.parse(raw) as T
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Body is not JSON.' })
  }
}

// The product must exist in the signed-in user's workspace; otherwise it does not exist for them.
export async function ownProduct(event: H3Event, id: unknown) {
  const productId = validId(id, 'product')
  const row = await envOf(event).DB.prepare('SELECT id FROM products WHERE id = ? AND workspace_id = ?')
    .bind(productId, userOf(event).workspaceId).first<{ id: string }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such product.' })
  return productId
}

export async function ownPost(event: H3Event, id: unknown) {
  const postId = validId(id, 'post')
  const row = await envOf(event).DB.prepare('SELECT p.id, p.product_id FROM posts p JOIN products pr ON pr.id = p.product_id WHERE p.id = ? AND pr.workspace_id = ?')
    .bind(postId, userOf(event).workspaceId).first<{ id: string; product_id: string }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such post.' })
  return row
}
