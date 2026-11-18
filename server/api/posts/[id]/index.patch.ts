import { PLATFORMS, type Platform } from '#shared/types'

// Edit one platform's text in place.
export default defineEventHandler(async (event) => {
  const post = await ownPost(event, getRouterParam(event, 'id'))
  const b = await body<{ platform?: string; text?: string }>(event, 50_000)
  if (!PLATFORMS.includes(b.platform as Platform)) throw createError({ statusCode: 400, statusMessage: 'Unknown platform.' })
  const db = envOf(event).DB
  const row = (await db.prepare('SELECT copy FROM posts WHERE id = ?').bind(post.id).first<{ copy: string }>())!
  const copy = JSON.parse(row.copy) as Record<string, string>
  copy[b.platform!] = String(b.text ?? '').slice(0, 40_000)
  await db.prepare('UPDATE posts SET copy = ? WHERE id = ?').bind(JSON.stringify(copy), post.id).run()
  return { ok: true }
})
