import type { H3Event } from 'h3'
import { FILLS, today, type Fill, type Memory, type Post, type Product } from '#shared/types'

const WEEK = 7 * 86_400_000

export async function listProducts(event: H3Event): Promise<Product[]> {
  const db = envOf(event).DB
  const day = today()
  const rows = await db.prepare(
    `SELECT p.id, p.name, p.url, p.colour, p.status, p.need, p.memory, p.creds IS NOT NULL AS has_login, p.read_at,
       (SELECT COUNT(*) FROM posts x WHERE x.product_id = p.id AND x.day = ? AND NOT EXISTS (SELECT 1 FROM postings g WHERE g.post_id = x.id)) AS ready,
       (SELECT COUNT(*) FROM postings g JOIN posts x ON x.id = g.post_id WHERE x.product_id = p.id AND g.posted_at > ?) AS week
     FROM products p WHERE p.workspace_id = ? ORDER BY p.created_at`,
  ).bind(day, Date.now() - WEEK, userOf(event).workspaceId).all<{ id: string; name: string; url: string; colour: string; status: Product['status']; need: string | null; memory: string; has_login: number; read_at: number | null; ready: number; week: number }>()
  return rows.results.map(r => ({
    id: r.id, name: r.name, url: r.url, colour: r.colour as Fill, status: r.status, need: r.need,
    memory: JSON.parse(r.memory) as Memory, hasLogin: !!r.has_login, readAt: r.read_at, ready: r.ready, postedThisWeek: r.week,
  }))
}

export async function nextFill(event: H3Event): Promise<Fill> {
  const n = await envOf(event).DB.prepare('SELECT COUNT(*) AS n FROM products WHERE workspace_id = ?').bind(userOf(event).workspaceId).first<{ n: number }>()
  return FILLS[(n?.n ?? 0) % FILLS.length]!
}

export async function postsFor(event: H3Event, productId: string, day = today()): Promise<Post[]> {
  const db = envOf(event).DB
  const [posts, postings] = await Promise.all([
    db.prepare('SELECT p.*, u.email AS approver FROM posts p LEFT JOIN users u ON u.id = p.approved_by WHERE p.product_id = ? AND p.day = ? ORDER BY p.rank').bind(productId, day).all<Record<string, unknown>>(),
    db.prepare('SELECT g.post_id, g.platform, g.posted_at, u.email FROM postings g JOIN posts p ON p.id = g.post_id JOIN users u ON u.id = g.user_id WHERE p.product_id = ? AND p.day = ? ORDER BY g.posted_at').bind(productId, day).all<{ post_id: string; platform: string; posted_at: number; email: string }>(),
  ])
  return posts.results.map(r => ({
    id: r.id as string, productId, day, rank: r.rank as number, format: r.format as Post['format'], pattern: r.pattern as string,
    title: r.title as string, why: r.why as string, flag: (r.flag as string) || null, hook: r.hook as string,
    copy: JSON.parse(r.copy as string), visual: JSON.parse(r.visual as string), status: r.status as Post['status'],
    approvedBy: (r.approver as string) || null,
    postings: postings.results.filter(g => g.post_id === r.id).map(g => ({ platform: g.platform, by: g.email, at: g.posted_at })),
  }))
}
