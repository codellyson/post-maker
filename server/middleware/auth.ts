// Every /api route except sign-in needs a session. Writes must come from this site's own pages.
// /render pages are opened by the headless browser with a signed one-time token instead (server/utils/render.ts).
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  const origin = getRequestHeader(event, 'origin')
  if (event.method !== 'GET' && event.method !== 'HEAD' && origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused.' })
  }
  if (event.path.startsWith('/api/auth/') || event.path.startsWith('/api/render/')) return
  const user = await readSession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first.' })
  event.context.user = user
})
