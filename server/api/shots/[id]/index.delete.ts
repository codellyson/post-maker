// Remove a screen. Posts already written keep their text; their visual falls back to no image for this screen.
export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'), 'screen')
  const env = envOf(event)
  const row = await env.DB.prepare('SELECT s.r2_key FROM shots s JOIN products p ON p.id = s.product_id WHERE s.id = ? AND p.workspace_id = ?')
    .bind(id, userOf(event).workspaceId).first<{ r2_key: string }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such screen.' })
  await env.MEDIA.delete(row.r2_key)
  await env.DB.prepare('DELETE FROM shots WHERE id = ?').bind(id).run()
  return { ok: true }
})
