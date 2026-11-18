const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Invite a teammate by email. The link signs them in to this workspace.
export default defineEventHandler(async (event) => {
  const env = envOf(event)
  const u = userOf(event)
  const email = String((await body<{ email?: string }>(event, 1000)).email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address.' })
  const token = await createInvite(event, email)
  const link = `${getRequestURL(event).origin}/signin?invite=${token}&email=${encodeURIComponent(email)}`
  if (env.DEV_SHOW_CODE && isLocal(event)) return { ok: true, devLink: link }
  if (!env.EMAIL || !env.MAIL_FROM) throw createError({ statusCode: 500, statusMessage: 'Email is not set up.' })
  await env.EMAIL.send({
    from: env.MAIL_FROM,
    to: email,
    subject: `${u.email} invited you to Post maker`,
    text: `${u.email} invited you to their team on Post maker, where you get ready-to-post social posts for your products.\n\nJoin: ${link}\n\nThe link works for 7 days.`,
    html: `<p>${u.email} invited you to their team on Post maker, where you get ready-to-post social posts for your products.</p><p><a href="${link}">Join the team</a></p><p>The link works for 7 days.</p>`,
  })
  return { ok: true }
})
