export default defineEventHandler(async (event) => {
  const id = validId(getRouterParam(event, 'id'), 'job')
  await sweepStale(envOf(event).DB)
  const job = await envOf(event).DB.prepare('SELECT id, kind, status, progress, error FROM jobs WHERE id = ? AND workspace_id = ?')
    .bind(id, userOf(event).workspaceId).first<{ id: string; kind: string; status: string; progress: string; error: string | null }>()
  if (!job) throw createError({ statusCode: 404, statusMessage: 'No such job.' })
  return { ...job, progress: JSON.parse(job.progress) }
})
