// Undo an approval, e.g. approved by mistake or the facts changed. Back to waiting for review.
export default defineEventHandler(async (event) => {
  const post = await ownPost(event, getRouterParam(event, 'id'))
  await envOf(event).DB.prepare("UPDATE posts SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ?").bind(post.id).run()
  return { ok: true }
})
