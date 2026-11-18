import { FILLS, type Fill, type Memory, type Rule } from '#shared/types'

// The team corrects what Post maker learned. Every post written after uses the correction.
export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  const b = await body<{ name?: string; colour?: string; what?: string; who?: string; rules?: Rule[]; user?: string; pass?: string; clearLogin?: boolean }>(event, 20_000)
  const env = envOf(event)
  const row = (await env.DB.prepare('SELECT name, colour, memory, creds FROM products WHERE id = ?').bind(id).first<{ name: string; colour: string; memory: string; creds: string | null }>())!
  const memory = JSON.parse(row.memory) as Memory
  const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n)
  if (b.what !== undefined) memory.what = clip(b.what, 600)
  if (b.who !== undefined) memory.who = clip(b.who, 400)
  if (b.rules) {
    memory.rules = b.rules.slice(0, 30).map(r => ({ text: clip(r.text, 200), source: r.source === 'learned' ? 'learned' as const : 'team' as const, by: r.source === 'team' ? clip(r.by || userOf(event).email, 120) : undefined }))
      .filter(r => r.text)
  }
  const colour: Fill = FILLS.includes(b.colour as Fill) ? b.colour as Fill : row.colour as Fill
  const name = b.name ? clip(b.name, 40).toLowerCase() : row.name
  let creds = row.creds
  if (b.clearLogin) creds = null
  else if (b.user && b.pass) creds = await sealCreds(env, { user: clip(b.user, 200), pass: clip(b.pass, 200) })
  await env.DB.prepare('UPDATE products SET name = ?, colour = ?, memory = ?, creds = ?, updated_at = ? WHERE id = ?')
    .bind(name, colour, JSON.stringify(memory), creds, Date.now(), id).run()
  return { ok: true }
})
