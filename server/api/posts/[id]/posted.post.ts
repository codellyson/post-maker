import { PLATFORMS, type Platform } from '#shared/types'

// The person says where they posted it. Post maker never posts anything itself.
export default defineEventHandler(async (event) => {
  const post = await ownPost(event, getRouterParam(event, 'id'))
  const { platform } = await body<{ platform?: string }>(event, 200)
  if (!PLATFORMS.includes(platform as Platform)) throw createError({ statusCode: 400, statusMessage: 'Unknown platform.' })
  await envOf(event).DB.prepare('INSERT INTO postings (id, post_id, platform, user_id, posted_at) VALUES (?, ?, ?, ?, ?)')
    .bind(newId(), post.id, platform, userOf(event).id, Date.now()).run()
  return { ok: true }
})
