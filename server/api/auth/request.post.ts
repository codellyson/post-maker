const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const env = envOf(event)
  // Per-IP limit so nobody can use the form to flood inboxes.
  const ip = getRequestHeader(event, 'cf-connecting-ip') ?? 'local'
  if (env.SIGNIN_LIMIT && !(await env.SIGNIN_LIMIT.limit({ key: ip })).success)
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-in requests. Wait a minute and try again.' })
  const { email: raw } = await body<{ email?: string }>(event, 1000)
  const email = String(raw ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address.' })

  // One live code per address; asking again replaces it.
  const recent = await env.DB.prepare('SELECT expires_at FROM login_codes WHERE email = ?').bind(email).first<{ expires_at: number }>()
  if (recent && recent.expires_at - 14 * 60_000 > Date.now()) throw createError({ statusCode: 429, statusMessage: 'A code was just sent. Wait a minute before asking again.' })
  const code = randomCode()
  await env.DB.prepare('INSERT OR REPLACE INTO login_codes (email, code_hash, attempts, expires_at) VALUES (?, ?, 0, ?)')
    .bind(email, await sha256(code), Date.now() + 15 * 60_000).run()

  if (env.DEV_SHOW_CODE && isLocal(event)) {
    console.log(`[dev] sign-in code for ${email}: ${code}`)
    return { ok: true, devCode: code }
  }
  if (!env.EMAIL || !env.MAIL_FROM) throw createError({ statusCode: 500, statusMessage: 'Email is not set up.' })
  await env.EMAIL.send({
    from: env.MAIL_FROM,
    to: email,
    subject: `Your Post maker sign-in code: ${code}`,
    text: `Your Post maker sign-in code is ${code}\n\nIt works for 15 minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Your Post maker sign-in code is</p><p style="font-size:24px;letter-spacing:3px"><strong>${code}</strong></p><p>It works for 15 minutes. If you didn't ask for it, ignore this email.</p>`,
  })
  return { ok: true }
})
