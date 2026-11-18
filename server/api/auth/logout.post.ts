export default defineEventHandler(async (event) => {
  const user = await readSession(event)
  if (user) await endSession(event, user.tokenHash)
  return { ok: true }
})
