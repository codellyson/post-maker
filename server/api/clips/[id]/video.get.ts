// Serves a recorded clip. Video players seek with Range requests, so those are answered in part.
export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'))
  const env = envOf(event)
  const row = await env.DB.prepare('SELECT c.r2_key FROM clips c JOIN products p ON p.id = c.product_id WHERE c.id = ? AND p.workspace_id = ?')
    .bind(id, userOf(event).workspaceId).first<{ r2_key: string }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such clip.' })
  const head = await env.MEDIA.head(row.r2_key)
  if (!head) throw createError({ statusCode: 404, statusMessage: 'No such clip.' })
  const size = head.size
  const m = getRequestHeader(event, 'range')?.match(/^bytes=(\d*)-(\d*)$/)
  setHeader(event, 'content-type', 'video/mp4')
  setHeader(event, 'accept-ranges', 'bytes')
  setHeader(event, 'cache-control', 'private, max-age=3600')
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) { setResponseStatus(event, 416); setHeader(event, 'content-range', `bytes */${size}`); return '' }
    const obj = await env.MEDIA.get(row.r2_key, { range: { offset: start, length: end - start + 1 } })
    setResponseStatus(event, 206)
    setHeader(event, 'content-range', `bytes ${start}-${end}/${size}`)
    setHeader(event, 'content-length', end - start + 1)
    return obj!.body
  }
  const obj = await env.MEDIA.get(row.r2_key)
  setHeader(event, 'content-length', size)
  return obj!.body
})
