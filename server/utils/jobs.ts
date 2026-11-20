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

export type Progress = ((line: string) => Promise<void>) & { signal?: AbortSignal }

// Thrown from progress() when someone pressed stop; the job ends without saving its result.
class Stopped extends Error {}
const STALE_MS = 10 * 60_000

// A job that has not reported progress for 10 minutes has died (a crashed worker, a cut-off dev server). Mark it failed
// so the app stops showing it as busy and a new one can start; a stalled read leaves the product readable again.
export async function sweepStale(db: D1Database) {
  const cutoff = Date.now() - STALE_MS
  await db.batch([
    db.prepare("UPDATE products SET status = CASE WHEN read_at IS NOT NULL THEN 'ready' ELSE 'failed' END WHERE status IN ('new', 'reading') AND id IN (SELECT product_id FROM jobs WHERE kind = 'read' AND status IN ('queued', 'running') AND updated_at < ?)").bind(cutoff),
    db.prepare("UPDATE jobs SET status = 'failed', error = 'It stopped responding, so it was ended. Try again.', updated_at = ? WHERE status IN ('queued', 'running') AND updated_at < ?").bind(Date.now(), cutoff),
  ])
}

// Ends a running job at its next step. The AI call already under way still finishes; its result is not saved.
export async function stopJob(db: D1Database, jobId: string, workspaceId: string, by: string) {
  const job = await db.prepare("SELECT kind, product_id FROM jobs WHERE id = ? AND workspace_id = ? AND status IN ('queued', 'running')").bind(jobId, workspaceId).first<{ kind: Kind; product_id: string }>()
  if (!job) return false
  await db.batch([
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").bind(`Stopped by ${by}.`, Date.now(), jobId),
    ...(job.kind === 'read' ? [db.prepare("UPDATE products SET status = CASE WHEN read_at IS NOT NULL THEN 'ready' ELSE 'failed' END WHERE id = ?").bind(job.product_id)] : []),
  ])
  return true
}

export async function runJob(env: Env, jobId: string) {
  const job = await env.DB.prepare('SELECT id, kind, product_id FROM jobs WHERE id = ?').bind(jobId).first<{ id: string; kind: Kind; product_id: string }>()
  if (!job) return
  const lines: string[] = []
  // Watch for a stop every few seconds and cancel the AI call in flight, not just the steps after it.
  const abort = new AbortController()
  const watch = setInterval(async () => {
    const row = await env.DB.prepare('SELECT status FROM jobs WHERE id = ?').bind(jobId).first<{ status: string }>().catch(() => null)
    if (row && row.status !== 'queued' && row.status !== 'running') abort.abort()
  }, 3000)
  const progress: Progress = async (line) => {
    lines.push(line)
    const r = await env.DB.prepare("UPDATE jobs SET status = 'running', progress = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'running')").bind(JSON.stringify(lines), Date.now(), jobId).run()
    if (!r.meta.changes) throw new Stopped()
  }
  progress.signal = abort.signal
  try {
    await progress('started')
    if (job.kind === 'read') await readProduct(env, job.product_id, progress)
    else if (job.kind === 'write') await writePosts(env, job.product_id, progress)
    await env.DB.prepare("UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ? AND status = 'running'").bind(Date.now(), jobId).run()
  } catch (e) {
    if (e instanceof Stopped || abort.signal.aborted) { console.log('job stopped', job.kind, jobId); return }
    const message = e instanceof Error ? e.message : String(e)
    console.error('job failed', job.kind, jobId, message)
    await env.DB.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").bind(message.slice(0, 500), Date.now(), jobId).run()
    if (job.kind === 'read') await env.DB.prepare("UPDATE products SET status = 'failed', updated_at = ? WHERE id = ?").bind(Date.now(), job.product_id).run()
  } finally {
    clearInterval(watch)
  }
}
