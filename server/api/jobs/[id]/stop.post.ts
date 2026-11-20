// Stop a running read or write. It ends at its next step and saves nothing.
export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'), 'job')
  const user = userOf(event)
  const stopped = await stopJob(envOf(event).DB, id, user.workspaceId, user.email)
  if (!stopped) throw createError({ statusCode: 409, statusMessage: 'It already finished.' })
  return { ok: true }
})
