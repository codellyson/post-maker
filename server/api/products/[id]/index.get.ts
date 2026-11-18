import type { Clip, Shipped, Shot } from '#shared/types'

export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  const db = envOf(event).DB
  const [product, shots, job, shipped, clips] = await Promise.all([
    listProducts(event).then(all => all.find(p => p.id === id)!),
    db.prepare('SELECT id, label, page, w, h, use, source FROM shots WHERE product_id = ? ORDER BY source DESC, created_at').bind(id).all<{ id: string; label: string; page: string; w: number; h: number; use: number; source: 'read' | 'upload' | 'local' }>(),
    db.prepare('SELECT id, kind, status, progress, error FROM jobs WHERE product_id = ? ORDER BY created_at DESC LIMIT 1').bind(id).first<{ id: string; kind: string; status: string; progress: string; error: string | null }>(),
    db.prepare('SELECT sha, subject, at FROM shipped WHERE product_id = ? ORDER BY at DESC LIMIT 20').bind(id).all<Shipped>(),
    db.prepare('SELECT id, title, why, captions, duration, w, h, use FROM clips WHERE product_id = ? AND use = 1 ORDER BY created_at').bind(id).all<{ id: string; title: string; why: string; captions: string; duration: number; w: number; h: number; use: number }>(),
  ])
  return {
    product,
    shots: shots.results.map((s): Shot => ({ id: s.id, label: s.label, page: s.page, w: s.w, h: s.h, use: !!s.use, source: s.source, url: `/api/shots/${s.id}/image` })),
    shipped: shipped.results,
    clips: clips.results.map((c): Clip => ({ ...c, captions: JSON.parse(c.captions), use: !!c.use, url: `/api/clips/${c.id}/video` })),
    job: job ? { ...job, progress: JSON.parse(job.progress) } : null,
  }
})
