// Read the site again, e.g. after it changed or a demo login was added.
export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  await assertIdle(event, id)
  return { jobId: await startJob(event, 'read', id) }
})
