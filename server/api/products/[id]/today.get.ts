import { today } from '#shared/types'

export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  const db = envOf(event).DB
  const day = today()
  const [posts, dropped, job] = await Promise.all([
    postsFor(event, id, day),
    db.prepare('SELECT title, reason FROM dropped WHERE product_id = ? AND day = ?').bind(id, day).all<{ title: string; reason: string }>(),
    db.prepare("SELECT id, kind, status, progress, error FROM jobs WHERE product_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1").bind(id, Date.now() - 3_600_000).first<{ id: string; kind: string; status: string; progress: string; error: string | null }>(),
  ])
  return { day, posts, dropped: dropped.results, job: job ? { ...job, progress: JSON.parse(job.progress) } : null }
})
