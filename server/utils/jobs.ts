import type { H3Event } from 'h3'

type Kind = 'read' | 'write' | 'render'

// Records a job and hands it to the queue. In `nuxt dev` there is no queue consumer, so it runs in the background here.
export async function startJob(event: H3Event, kind: Kind, productId: string) {
  const env = envOf(event)
  const id = newId()
  const now = Date.now()
  await env.DB.prepare('INSERT INTO jobs (id, workspace_id, product_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userOf(event).workspaceId, productId, kind, now, now).run()
  if (import.meta.dev) event.waitUntil(runJob(env, id))
  else await env.JOBS.send({ jobId: id })
  return id
}

// One job at a time per product, so two people pressing the same button don't pay for it twice.
export async function assertIdle(event: H3Event, productId: string) {
  const busy = await envOf(event).DB.prepare("SELECT 1 FROM jobs WHERE product_id = ? AND status IN ('queued', 'running') AND updated_at > ?")
    .bind(productId, Date.now() - 15 * 60_000).first()
  if (busy) throw createError({ statusCode: 409, statusMessage: 'Already working on this product. It will show up here when it is done.' })
}

// Queue a job outside a request (the daily cron).
export async function queueJob(env: Env, workspaceId: string, kind: Kind, productId: string) {
  const id = newId()
  const now = Date.now()
  await env.DB.prepare('INSERT INTO jobs (id, workspace_id, product_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, workspaceId, productId, kind, now, now).run()
  await env.JOBS.send({ jobId: id })
}

export type Progress = (line: string) => Promise<void>

export async function runJob(env: Env, jobId: string) {
  const job = await env.DB.prepare('SELECT id, kind, product_id FROM jobs WHERE id = ?').bind(jobId).first<{ id: string; kind: Kind; product_id: string }>()
  if (!job) return
  const lines: string[] = []
  const progress: Progress = async (line) => {
    lines.push(line)
    await env.DB.prepare("UPDATE jobs SET status = 'running', progress = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(lines), Date.now(), jobId).run()
  }
  try {
    await progress('started')
    if (job.kind === 'read') await readProduct(env, job.product_id, progress)
    else if (job.kind === 'write') await writePosts(env, job.product_id, progress)
    await env.DB.prepare("UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?").bind(Date.now(), jobId).run()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('job failed', job.kind, jobId, message)
    await env.DB.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").bind(message.slice(0, 500), Date.now(), jobId).run()
    if (job.kind === 'read') await env.DB.prepare("UPDATE products SET status = 'failed', updated_at = ? WHERE id = ?").bind(Date.now(), job.product_id).run()
  }
}
