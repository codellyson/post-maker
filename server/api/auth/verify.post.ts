export default defineEventHandler(async (event) => {
  const env = envOf(event)
  const b = await body<{ email?: string; code?: string; invite?: string }>(event, 1000)
  const email = String(b.email ?? '').trim().toLowerCase()
  const code = String(b.code ?? '').replace(/\s/g, '')
  const expired = () => createError({ statusCode: 400, statusMessage: 'That code has expired. Ask for a new one.' })

  const row = await env.DB.prepare('SELECT code_hash, attempts, expires_at FROM login_codes WHERE email = ?')
    .bind(email).first<{ code_hash: string; attempts: number; expires_at: number }>()
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) throw expired()
  if (row.code_hash !== (await sha256(code))) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run()
    throw createError({ statusCode: 400, statusMessage: "That code doesn't match. Check the email and try again." })
  }
  // Single use: whoever deletes the row wins, so a code can't be spent twice in parallel.
  const used = await env.DB.prepare('DELETE FROM login_codes WHERE email = ? AND code_hash = ?').bind(email, row.code_hash).run()
  if (!used.meta.changes) throw expired()

  await env.DB.prepare('INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(newId(), email, Date.now()).run()
  const user = (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!

  // An invite for this address joins its workspace before any personal one is made.
  if (b.invite) await acceptInvite(event, String(b.invite), user.id, email)
  await ensureWorkspace(event, user.id, email)
  await startSession(event, user.id)
  return { ok: true }
})
