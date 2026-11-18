export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  const env = envOf(event)
  const keys = (await env.DB.prepare('SELECT r2_key FROM shots WHERE product_id = ?').bind(id).all<{ r2_key: string }>()).results.map(r => r.r2_key)
  if (keys.length) await env.MEDIA.delete(keys)
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  return { ok: true }
})
