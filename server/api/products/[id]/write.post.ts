// "More ideas": writes another batch for today, never repeating today's or recent angles.
export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  await assertIdle(event, id)
  await assertUnderCap(event, id, 'write')
  return { jobId: await startJob(event, 'write', id) }
})
