// Serves a screen's image. The screen's product must be in the viewer's workspace.
export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'), 'screen')
  const env = envOf(event)
  const row = await env.DB.prepare('SELECT s.r2_key, s.mime FROM shots s JOIN products p ON p.id = s.product_id WHERE s.id = ? AND p.workspace_id = ?')
    .bind(id, userOf(event).workspaceId).first<{ r2_key: string; mime: string }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  const obj = await env.MEDIA.get(row.r2_key)
  if (!obj) throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  setResponseHeaders(event, { 'content-type': row.mime, 'cache-control': 'private, max-age=86400' })
  return obj.body
})
