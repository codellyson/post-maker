// The team's posting log: what went out, where, by whom. Last 60 days.
export default defineEventHandler(async (event) => {
  const rows = await envOf(event).DB.prepare(
    `SELECT g.posted_at, g.platform, u.email, p.title, p.pattern, pr.name AS product, pr.colour
     FROM postings g JOIN posts p ON p.id = g.post_id JOIN products pr ON pr.id = p.product_id JOIN users u ON u.id = g.user_id
     WHERE pr.workspace_id = ? AND g.posted_at > ? ORDER BY g.posted_at DESC LIMIT 300`,
  ).bind(userOf(event).workspaceId, Date.now() - 60 * 86_400_000).all<{ posted_at: number; platform: string; email: string; title: string; pattern: string; product: string; colour: string }>()
  return rows.results
})
