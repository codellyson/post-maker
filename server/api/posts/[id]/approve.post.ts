export default defineEventHandler(async (event) => {
  const post = await ownPost(event, getRouterParam(event, 'id'))
  await envOf(event).DB.prepare("UPDATE posts SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?")
    .bind(userOf(event).id, Date.now(), post.id).run()
  return { ok: true }
})
