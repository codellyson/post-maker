// Choose whether a screen may be used in posts, or rename it. The name tells the writer what the screen shows.
export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'), 'screen')
  const b = await body<{ use?: boolean; label?: string }>(event, 1000)
  const db = envOf(event).DB
  const owned = await db.prepare('SELECT s.id FROM shots s JOIN products p ON p.id = s.product_id WHERE s.id = ? AND p.workspace_id = ?').bind(id, userOf(event).workspaceId).first()
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'No such screen.' })
  if (b.use !== undefined) await db.prepare('UPDATE shots SET use = ? WHERE id = ?').bind(b.use ? 1 : 0, id).run()
  if (b.label !== undefined) {
    const label = String(b.label).trim().slice(0, 80)
    if (!label) throw createError({ statusCode: 400, statusMessage: 'Give the screen a name.' })
    await db.prepare('UPDATE shots SET label = ? WHERE id = ?').bind(label, id).run()
  }
  return { ok: true }
})
