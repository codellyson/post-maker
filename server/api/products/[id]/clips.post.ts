// The desktop engine sends this run's screen recordings (MP4). They replace the last run's.
const MAX_CLIPS = 4
const MAX_BYTES = 40 * 1024 * 1024

type Meta = { title: string; why: string; captions: { at: number; cap: string }[]; duration: number; w: number; h: number }

export default defineEventHandler(async (event) => {
  const productId = await ownProduct(event, getRouterParam(event, 'id'))
  const env = envOf(event)
  const parts = await readMultipartFormData(event) ?? []
  let metas: Meta[]
  try { metas = JSON.parse(parts.find(p => p.name === 'meta')?.data.toString('utf8') ?? '[]') } catch { throw createError({ statusCode: 400, statusMessage: 'Bad meta.' }) }
  const clips = metas.slice(0, MAX_CLIPS).map((m, i) => ({ m, file: parts.find(p => p.name === `clip${i}`) }))
  for (const { file } of clips) {
    const b = file?.data
    // MP4 files carry "ftyp" at byte 4.
    if (!b || b.length > MAX_BYTES || b.subarray(4, 8).toString('latin1') !== 'ftyp') throw createError({ statusCode: 400, statusMessage: 'Each clip must be an MP4 under 40 MB.' })
  }
  if (!clips.length) return { clips: 0 }
  const db = env.DB
  // Clips a post already uses stay, so its video keeps playing; they just leave the writer's list.
  const old = (await db.prepare(`SELECT c.id, c.r2_key, EXISTS (SELECT 1 FROM posts p WHERE p.product_id = c.product_id AND p.visual LIKE '%"video":"' || c.id || '"%') AS used FROM clips c WHERE c.product_id = ?`)
    .bind(productId).all<{ id: string; r2_key: string; used: number }>()).results
  const stale = old.filter(c => !c.used)
  if (stale.length) await env.MEDIA.delete(stale.map(c => c.r2_key))
  const now = Date.now()
  const stmts = [
    ...stale.map(c => db.prepare('DELETE FROM clips WHERE id = ?').bind(c.id)),
    ...old.filter(c => c.used).map(c => db.prepare('UPDATE clips SET use = 0 WHERE id = ?').bind(c.id)),
  ]
  for (const { m, file } of clips) {
    const id = newId()
    const key = `clips/${productId}/${id}.mp4`
    await env.MEDIA.put(key, file!.data, { httpMetadata: { contentType: 'video/mp4' } })
    const captions = (m.captions ?? []).slice(0, 20).map(c => ({ at: Math.max(0, Number(c.at) || 0), cap: String(c.cap).slice(0, 160) }))
    stmts.push(db.prepare('INSERT INTO clips (id, product_id, r2_key, title, why, captions, duration, w, h, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, productId, key, String(m.title).slice(0, 80), String(m.why).slice(0, 300), JSON.stringify(captions), Number(m.duration) || 0, Math.round(m.w) || 0, Math.round(m.h) || 0, now))
  }
  await db.batch(stmts)
  return { clips: clips.length }
})
