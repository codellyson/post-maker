// The engine's local HTTP API on 127.0.0.1:4710. Only the Post maker web app may call it:
// requests from any other site are refused, and writes must be JSON so a plain form post can't trigger them.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { check, fix, running } from './setup.ts'
import { openForSetup, readLocal } from './read.ts'
import { loadConfig, saveConfig, type Repo } from './shell.ts'

const PORT = Number(process.env.PM_ENGINE_PORT || 4710)
const ORIGINS = (process.env.PM_ORIGINS || 'http://localhost:3417,https://postmaker.kreativekorna.com').split(',')
const ID = /^[a-z0-9]{6,16}$/

type Job = { status: 'running' | 'done' | 'failed'; progress: string[]; error: string | null; productId: string }
const jobs = new Map<string, Job>()
const busy = new Set<string>()

// Saves one repo's settings without losing changes made to others meanwhile.
const saveRepo = (pid: string, repo: Repo) => { const c = loadConfig(); c.repos[pid] = repo; saveConfig(c) }

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}
async function json<T>(req: IncomingMessage): Promise<T> {
  let raw = ''
  for await (const c of req) { raw += c; if (raw.length > 100_000) throw new Error('Too large.') }
  return raw ? JSON.parse(raw) : ({} as T)
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !ORIGINS.includes(origin)) return send(res, 403, { error: 'This site may not use the Post maker engine.' })
  if (origin) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'origin')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT')
    res.setHeader('access-control-allow-private-network', 'true')
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method !== 'GET' && !(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' })

  const parts = (req.url ?? '/').split('?')[0]!.split('/').filter(Boolean)
  const cfg = loadConfig()
  try {
    if (req.method === 'GET' && parts[0] === 'health') return send(res, 200, { app: 'post-maker-engine', connected: !!cfg.key, base: cfg.base ?? null })

    if (req.method === 'POST' && parts[0] === 'connect') {
      const b = await json<{ key?: string }>(req)
      if (!origin || !/^pmk_[a-f0-9]{64}$/.test(b.key ?? '')) return send(res, 400, { error: 'Bad key.' })
      // The key works only with the site that made it.
      cfg.base = origin
      cfg.key = b.key
      saveConfig(cfg)
      return send(res, 200, { connected: true })
    }

    if (parts[0] === 'jobs' && parts[1]) {
      const job = jobs.get(parts[1])
      return job ? send(res, 200, job) : send(res, 404, { error: 'No such job.' })
    }

    if (parts[0] === 'repos' && ID.test(parts[1] ?? '')) {
      const pid = parts[1]!
      const repo = cfg.repos[pid]
      if (req.method === 'GET' && !parts[2]) {
        const running = [...jobs.entries()].find(([, j]) => j.productId === pid && j.status === 'running')
        return send(res, 200, { repo: repo ? { path: repo.path, url: repo.url ?? '', login: repo.login?.user ?? '', readAt: repo.readAt ?? null } : null, jobId: running?.[0] ?? null })
      }
      if (req.method === 'PUT' && !parts[2]) {
        const b = await json<{ path?: string; url?: string; login?: { user: string; pass: string } | null }>(req)
        const path = (b.path ?? '').trim().replace(/^~(?=\/)/, process.env.HOME ?? '~').replace(/\/$/, '')
        if (!path.startsWith('/') || !existsSync(path) || !statSync(path).isDirectory()) return send(res, 400, { error: 'That folder does not exist on this Mac.' })
        if (!existsSync(join(path, 'package.json'))) return send(res, 400, { error: 'No package.json in that folder. Pick the repo’s root folder.' })
        if (!existsSync(join(path, '.git'))) return send(res, 400, { error: 'That folder is not a git repo.' })
        const url = (b.url ?? '').trim()
        if (url && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.replace(/\/$/, ''))) return send(res, 400, { error: 'Use a local address like http://localhost:3000.' })
        cfg.repos[pid] = { ...repo, path, url: url.replace(/\/$/, '') || undefined, login: b.login === null ? undefined : b.login?.user ? b.login : repo?.login }
        saveConfig(cfg)
        return send(res, 200, { ok: true })
      }
      if (!repo) return send(res, 404, { error: 'Set the repo folder first.' })
      if (busy.has(pid)) return send(res, 409, { error: 'Already working on this repo. Wait for it to finish.' })
      if (req.method === 'POST' && parts[2] === 'check') {
        busy.add(pid)
        try { const items = await check(repo); saveRepo(pid, repo); return send(res, 200, { items }) } finally { busy.delete(pid) }
      }
      if (req.method === 'POST' && parts[2] === 'fix') {
        const b = await json<{ action: string; values?: Record<string, string>; file?: string }>(req)
        busy.add(pid)
        try {
          const r = await fix(repo, b.action, b.values, b.file)
          saveRepo(pid, repo)
          return send(res, r.code ? 500 : 200, { ok: !r.code, out: r.out.trim().split('\n').slice(-15).join('\n') })
        } finally { busy.delete(pid) }
      }
      if (req.method === 'POST' && (parts[2] === 'read' || parts[2] === 'open')) {
        const jobId = Math.random().toString(36).slice(2, 12)
        const job: Job = { status: 'running', progress: ['started'], error: null, productId: pid }
        jobs.set(jobId, job)
        busy.add(pid)
        ;(parts[2] === 'read' ? readLocal : openForSetup)(cfg, pid, l => job.progress.push(l))
          .then(() => { job.status = 'done' })
          .catch((e) => { job.status = 'failed'; job.error = (e as Error).message })
          .finally(() => { saveRepo(pid, cfg.repos[pid]!); busy.delete(pid) })
        return send(res, 200, { jobId })
      }
    }
    send(res, 404, { error: 'Not found.' })
  } catch (e) {
    send(res, 500, { error: (e as Error).message })
  }
})
// Starting an app or waiting on a person can take minutes.
server.requestTimeout = 0
server.listen(PORT, '127.0.0.1', () => console.log(`Post maker engine on http://127.0.0.1:${PORT}`))

// The desktop app sends SIGTERM when it quits: stop any dev server first.
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { for (const stop of [...running]) stop(); setTimeout(() => process.exit(0), 3500) })
