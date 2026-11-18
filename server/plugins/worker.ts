import { today } from "#shared/types"

// Queue consumer and daily cron. Both run outside any request, with the Worker's env.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async ({ batch, env }) => {
    for (const msg of (batch as MessageBatch<JobMessage>).messages) {
      await runJob(env as Env, msg.body.jobId)
      msg.ack()
    }
  })

  // Every product that is ready and has nothing for today gets today's posts written.
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ env }) => {
    const e = env as Env
    const day = today()
    const rows = await e.DB.prepare(
      "SELECT id, workspace_id FROM products WHERE status = 'ready' AND id NOT IN (SELECT product_id FROM posts WHERE day = ?)",
    ).bind(day).all<{ id: string; workspace_id: string }>()
    for (const r of rows.results) await queueJob(e, r.workspace_id, 'write', r.id)
  })
})
