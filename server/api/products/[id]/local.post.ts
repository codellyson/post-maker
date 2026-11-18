import type { Memory } from '#shared/types'

// The desktop app sends what it read from the product's local repo: screens of the app running
// on the team's machine, the commits since its last run, and the README.
// Each run replaces the previous local screens; commits add up.
const MAX_SHOTS = 16
const MAX_BYTES = 8 * 1024 * 1024

type Meta = {
  readme?: string
  commits?: { sha: string; subject: string; at: number }[]
  shots?: { label: string; page: string; w: number; h: number }[]
}

export default defineEventHandler(async (event) => {
  const productId = await ownProduct(event, getRouterParam(event, 'id'))
  const env = envOf(event)
  const db = env.DB
  const parts = await readMultipartFormData(event) ?? []
  let meta: Meta
  try {
    meta = JSON.parse(parts.find(p => p.name === 'meta')?.data.toString('utf8') ?? '{}')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad meta.' })
  }
  const files = (meta.shots ?? []).slice(0, MAX_SHOTS).map((s, i) => ({ s, file: parts.find(p => p.name === `shot${i}`) }))
  for (const { file } of files) {
    const b = file?.data
    if (!b || b.length > MAX_BYTES || b[0] !== 0x89 || b[1] !== 0x50) throw createError({ statusCode: 400, statusMessage: 'Each screen must be a PNG under 8 MB.' })
  }

  const now = Date.now()
  const stmts = []
  // A run that found no screens keeps the last run's.
  if (files.length) {
    const stale = (await db.prepare("SELECT r2_key FROM shots WHERE product_id = ? AND source = 'local'").bind(productId).all<{ r2_key: string }>()).results.map(r => r.r2_key)
    if (stale.length) await env.MEDIA.delete(stale)
    stmts.push(db.prepare("DELETE FROM shots WHERE product_id = ? AND source = 'local'").bind(productId))
  }
  for (const { s, file } of files) {
    const id = newId()
    const key = `shots/${productId}/${id}.png`
    await env.MEDIA.put(key, file!.data, { httpMetadata: { contentType: 'image/png' } })
    const dim = (v: number) => (v > 0 && v < 20000 ? Math.round(v) : 0)
    stmts.push(db.prepare("INSERT INTO shots (id, product_id, r2_key, label, page, w, h, use, source, mime, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'local', 'image/png', ?, ?)")
      .bind(id, productId, key, String(s.label).slice(0, 80), String(s.page).slice(0, 200), dim(s.w), dim(s.h), userOf(event).id, now))
  }
  for (const c of (meta.commits ?? []).slice(0, 200)) {
    if (!/^[a-f0-9]{7,40}$/.test(c.sha)) continue
    stmts.push(db.prepare('INSERT OR IGNORE INTO shipped (product_id, sha, subject, at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(productId, c.sha, String(c.subject).slice(0, 200), Number(c.at) || now, now))
  }
  if (meta.readme) {
    const p = await db.prepare('SELECT memory FROM products WHERE id = ?').bind(productId).first<{ memory: string }>()
    const memory = JSON.parse(p!.memory) as Memory
    memory.repo = { readme: meta.readme.slice(0, 8000), at: now }
    stmts.push(db.prepare('UPDATE products SET memory = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(memory), now, productId))
  }
  await db.batch(stmts)
  return { shots: files.length, commits: meta.commits?.length ?? 0 }
})
