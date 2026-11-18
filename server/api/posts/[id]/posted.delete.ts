// Undo the last "mark posted" on this post.
export default defineEventHandler(async (event) => {
  const post = await ownPost(event, getRouterParam(event, 'id'))
  await envOf(event).DB.prepare('DELETE FROM postings WHERE id = (SELECT id FROM postings WHERE post_id = ? ORDER BY posted_at DESC LIMIT 1)').bind(post.id).run()
  return { ok: true }
})
