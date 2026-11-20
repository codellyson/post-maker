import type { H3Event } from 'h3'
import { FILLS, today, type Fill, type Memory, type Post, type Product } from '#shared/types'

const WEEK = 7 * 86_400_000

export async function listProducts(event: H3Event): Promise<Product[]> {
  const db = envOf(event).DB
  const day = today()
  await sweepStale(db)
  const rows = await db.prepare(
    `SELECT p.id, p.name, p.url, p.colour, p.status, p.need, p.memory, p.creds IS NOT NULL AS has_login, p.read_at,
       (SELECT COUNT(*) FROM posts x WHERE x.product_id = p.id AND x.day = ? AND x.replaced_at IS NULL AND NOT EXISTS (SELECT 1 FROM postings g WHERE g.post_id = x.id)) AS ready,
       (SELECT COUNT(*) FROM postings g JOIN posts x ON x.id = g.post_id WHERE x.product_id = p.id AND g.posted_at > ?) AS week,
       (SELECT j.kind FROM jobs j WHERE j.product_id = p.id AND j.status IN ('queued', 'running') AND j.kind IN ('read', 'write') AND j.created_at > ? ORDER BY j.created_at DESC LIMIT 1) AS job
     FROM products p WHERE p.workspace_id = ? ORDER BY p.created_at`,
  ).bind(day, Date.now() - WEEK, Date.now() - 3_600_000, userOf(event).workspaceId).all<{ id: string; name: string; url: string; colour: string; status: Product['status']; need: string | null; memory: string; has_login: number; read_at: number | null; ready: number; week: number; job: 'read' | 'write' | null }>()
  return rows.results.map(r => ({
    id: r.id, name: r.name, url: r.url, colour: r.colour as Fill, status: r.status, need: r.need,
    memory: JSON.parse(r.memory) as Memory, hasLogin: !!r.has_login, readAt: r.read_at, ready: r.ready, postedThisWeek: r.week, job: r.job,
  }))
}

export async function nextFill(event: H3Event): Promise<Fill> {
  const n = await envOf(event).DB.prepare('SELECT COUNT(*) AS n FROM products WHERE workspace_id = ?').bind(userOf(event).workspaceId).first<{ n: number }>()
  return FILLS[(n?.n ?? 0) % FILLS.length]!
}

// One day's posts, or with day null every post from the last 90 days, newest day first.
export async function postsFor(event: H3Event, productId: string, day: string | null = today()): Promise<Post[]> {
  const db = envOf(event).DB
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const where = day ? 'p.day = ? AND p.replaced_at IS NULL' : 'p.day >= ?'
  const [posts, postings] = await Promise.all([
    db.prepare(`SELECT p.*, u.email AS approver FROM posts p LEFT JOIN users u ON u.id = p.approved_by WHERE p.product_id = ? AND ${where} ORDER BY p.day DESC, p.replaced_at IS NOT NULL, p.rank`).bind(productId, day ?? since).all<Record<string, unknown>>(),
    db.prepare(`SELECT g.post_id, g.platform, g.posted_at, u.email FROM postings g JOIN posts p ON p.id = g.post_id JOIN users u ON u.id = g.user_id WHERE p.product_id = ? AND ${where} ORDER BY g.posted_at`).bind(productId, day ?? since).all<{ post_id: string; platform: string; posted_at: number; email: string }>(),
  ])
  return posts.results.map(r => ({
    id: r.id as string, productId, day: r.day as string, rank: r.rank as number, format: r.format as Post['format'], pattern: r.pattern as string,
    title: r.title as string, why: r.why as string, flag: (r.flag as string) || null, hook: r.hook as string,
    copy: JSON.parse(r.copy as string), visual: JSON.parse(r.visual as string), status: r.status as Post['status'],
    approvedBy: (r.approver as string) || null,
    replaced: !!r.replaced_at,
    postings: postings.results.filter(g => g.post_id === r.id).map(g => ({ platform: g.platform, by: g.email, at: g.posted_at })),
  }))
}
