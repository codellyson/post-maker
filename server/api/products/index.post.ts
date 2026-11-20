// Add a product by its live link. Reading the site starts straight away, in the background.
export default defineEventHandler(async (event) => {
  const b = await body<{ url?: string; name?: string; user?: string; pass?: string }>(event, 4000)
  let url: URL
  try {
    url = new URL(String(b.url ?? '').trim())
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Paste the full link, starting with https://' })
  }
  if (url.protocol !== 'https:' && !(import.meta.dev && url.protocol === 'http:')) throw createError({ statusCode: 400, statusMessage: 'The link must start with https://' })
  const name = (String(b.name ?? '').trim() || url.hostname.replace(/^www\./, '').split('.')[0]!).toLowerCase().slice(0, 40)
  const env = envOf(event)
  // Each new product starts a paid read; cap how many a team can add in a day.
  const added = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE workspace_id = ? AND created_at > ?').bind(userOf(event).workspaceId, Date.now() - 86_400_000).first<{ n: number }>()
  if ((added?.n ?? 0) >= 10) throw createError({ statusCode: 429, statusMessage: 'That is 10 new products today. Try again tomorrow.' })
  const creds = b.user && b.pass ? await sealCreds(env, { user: String(b.user).slice(0, 200), pass: String(b.pass).slice(0, 200) }) : null
  const id = newId()
  const now = Date.now()
  await env.DB.prepare('INSERT INTO products (id, workspace_id, name, url, colour, creds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userOf(event).workspaceId, name, url.href, await nextFill(event), creds, now, now).run()
  const jobId = await startJob(event, 'read', id)
  return { id, jobId }
})
