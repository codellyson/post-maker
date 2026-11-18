// The setup check: everything a recording needs, each with what is wrong and the fix.
// Only a "fail" blocks reading; a "warn" is worth knowing but the read still works.
import { existsSync, readdirSync, readFileSync, appendFileSync, statSync } from 'node:fs'
import { connect } from 'node:net'
import { join, relative } from 'node:path'
import { chromePath, sh, start, stopGroup, stripAnsi, type Repo } from './shell.ts'

import type { SetupItem as Item } from '../shared/types.ts'
export type { Item }

export function packageManager(dir: string) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
  return 'npm'
}

const SKIP = new Set(['node_modules', '.git', '.nuxt', '.output', '.next', 'dist', 'build', '.wrangler', '.turbo'])
// Example env files and the real files they stand for.
const EXAMPLES: Record<string, string[]> = {
  '.env.example': ['.env', '.env.local'],
  '.env.sample': ['.env', '.env.local'],
  '.env.local.example': ['.env.local'],
  '.dev.vars.example': ['.dev.vars'],
}

function findExamples(root: string, depth = 3): string[] {
  const out: string[] = []
  const walk = (dir: string, d: number) => {
    let names: string[] = []
    try { names = readdirSync(dir) } catch { return }
    for (const n of names) {
      if (EXAMPLES[n]) out.push(join(dir, n))
      else if (d > 0 && !SKIP.has(n) && !n.startsWith('.')) {
        const p = join(dir, n)
        try { if (statSync(p).isDirectory()) walk(p, d - 1) } catch {}
      }
    }
  }
  walk(root, depth)
  return out
}

export function parseEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {}
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { return out }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]!] = m[2]!.trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

function envState(root: string) {
  const missing: { file: string; keys: string[]; required: string[] }[] = []
  const values: Record<string, string> = {}
  for (const ex of findExamples(root)) {
    const dir = join(ex, '..')
    const name = ex.slice(dir.length + 1)
    const targets = EXAMPLES[name]!.map(t => join(dir, t))
    const have: Record<string, string> = Object.assign({}, ...targets.map(parseEnv))
    Object.assign(values, have)
    // An example with a real-looking value is an optional default; an empty or placeholder value must be filled in.
    const example = parseEnv(ex)
    const placeholder = (v: string) => !v || /your|xxx|change ?me|<|\.\.\.|replace|todo|secret|key here/i.test(v)
    const keys = Object.keys(example).filter(k => !have[k])
    if (keys.length) missing.push({ file: relative(root, targets[0]!), keys, required: keys.filter(k => placeholder(example[k]!)) })
  }
  // Env files with no example still name the databases the app uses.
  for (const f of ['.env', '.env.local', '.dev.vars']) Object.assign(values, parseEnv(join(root, f)))
  return { missing, values, examples: findExamples(root).length }
}

function reachable(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const s = connect({ host, port, timeout: 1500 }, () => { s.destroy(); resolve(true) })
    s.on('error', () => resolve(false))
    s.on('timeout', () => { s.destroy(); resolve(false) })
  })
}
const DEFAULT_PORTS: Record<string, number> = { postgres: 5432, postgresql: 5432, mysql: 3306, mongodb: 27017, redis: 6379 }

// Dev servers this engine started and hasn't stopped yet, so quitting the app stops them too.
export const running = new Set<() => void>()

// Starts the repo's dev script on a free port, and resolves once the page answers.
export async function startApp(repo: Repo, onLog?: (line: string) => void) {
  const pm = packageManager(repo.path)
  // Same port every run: browsers keep some sign-ins (local storage) per port.
  const port = repo.port ?? 4800 + Math.floor(Math.random() * 900)
  repo.port = port
  const child = start(`${pm} run dev`, repo.path, { PORT: String(port), NUXT_PORT: String(port), BROWSER: 'none', FORCE_COLOR: '0' })
  let log = ''
  let url = null as string | null
  const read = (b: Buffer) => {
    const text = stripAnsi(b.toString())
    log = (log + text).slice(-8000)
    for (const l of text.split('\n')) if (l.trim()) onLog?.(l.trim())
    url ??= text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/)?.[0] ?? null
  }
  child.stdout?.on('data', read)
  child.stderr?.on('data', read)
  const stop = () => { running.delete(stop); stopGroup(child) }
  running.add(stop)
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break
    if (url) {
      const res = await fetch(url, { redirect: 'manual' }).catch(() => null)
      // A dev server answers 5xx while it is still building.
      if (res && res.status < 500) { await new Promise(r => setTimeout(r, 3000)); return { url: url.replace(/\/$/, ''), stop, log: () => log } }
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  stop()
  const tail = log.trim().split('\n').slice(-12).join('\n')
  throw new Error(child.exitCode !== null ? `The dev script stopped:\n${tail}` : `The app did not answer within 3 minutes:\n${tail}`)
}

export async function check(repo: Repo): Promise<Item[]> {
  const root = repo.path
  const items: Item[] = []
  const pm = packageManager(root)

  const chrome = chromePath()
  const ff = await sh('command -v ffmpeg', root, 15_000)
  const node = await sh('node -v', root, 15_000)
  const pmv = await sh(`${pm} -v`, root, 15_000)
  const lacking = [!chrome && 'Chrome', ff.code && 'ffmpeg', node.code && 'Node', pmv.code && pm].filter(Boolean)
  items.push({
    id: 'tools', title: 'Tools',
    state: lacking.length ? 'fail' : 'ok',
    detail: lacking.length ? `Missing: ${lacking.join(', ')}.` : `Chrome, ffmpeg, Node ${node.out.trim()}, ${pm} ${pmv.out.trim()}.`,
    fix: ff.code && !(!chrome || node.code || pmv.code) ? { label: 'install ffmpeg with Homebrew', action: 'ffmpeg' } : undefined,
  })

  const deps = existsSync(join(root, 'node_modules'))
  items.push({ id: 'deps', title: 'Dependencies', state: deps ? 'ok' : 'fail', detail: deps ? 'Installed.' : `Not installed. Runs "${pm} install".`, fix: deps ? undefined : { label: `run ${pm} install`, action: 'deps' } })

  const env = envState(root)
  const required = env.missing.flatMap(m => m.required)
  const optional = env.missing.flatMap(m => m.keys.filter(k => !m.required.includes(k)))
  const first = env.missing.find(m => m.required.length) ?? env.missing[0]
  items.push({
    id: 'env', title: 'Env vars',
    state: required.length ? 'fail' : optional.length || !env.examples ? 'warn' : 'ok',
    detail: required.length ? `${required.length} missing: ${required.join(', ')}. Values stay on this Mac, in the repo's own env file.`
      : optional.length ? `Optional, not set: ${optional.join(', ')}. Their examples have defaults, so the app should start without them.`
      : env.examples ? 'All set.' : 'No example env file found, so nothing to compare. If the app needs keys, it will say so when it starts.',
    missing: first && { file: first.file, keys: first.keys },
  })

  const dbs = Object.entries(env.values).flatMap(([k, v]) => {
    const m = v.match(/^(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/(?:[^@/]*@)?([^:/?]+)(?::(\d+))?/)
    return m ? [{ key: k, host: m[2]!, port: Number(m[3]) || DEFAULT_PORTS[m[1]!.replace('+srv', '')] || 0 }] : []
  })
  const down: string[] = []
  for (const d of dbs) if (!d.port || !(await reachable(d.host, d.port))) down.push(`${d.key} (${d.host}:${d.port})`)
  const compose = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].find(f => existsSync(join(root, f)))
  items.push({
    id: 'services', title: 'Database and services',
    state: down.length ? 'fail' : 'ok',
    detail: !dbs.length ? 'None found in the env files.' : down.length ? `Not answering: ${down.join(', ')}.${compose ? ` Start them with "docker compose up -d" (${compose}).` : ' Start it, then check again.'}` : `${dbs.map(d => d.key).join(', ')} answering.`,
    fix: down.length && compose ? { label: 'run docker compose up -d', action: 'compose' } : undefined,
  })

  // The read shows whatever is checked out; an old branch means old screens.
  const branch = (await sh('git rev-parse --abbrev-ref HEAD', root, 15_000)).out.trim()
  const def = await sh('git symbolic-ref --short refs/remotes/origin/HEAD', root, 15_000)
  const behind = def.code ? 0 : Number((await sh(`git rev-list --count HEAD..${def.out.trim()}`, root, 15_000)).out.trim()) || 0
  items.push({
    id: 'branch', title: 'Branch',
    state: behind > 20 ? 'warn' : 'ok',
    detail: behind > 20 ? `${branch} is ${behind} commits behind ${def.out.trim()}, so the screens show an older app. Check out the latest code for current screens.` : `${branch}${behind ? `, ${behind} commits behind ${def.out.trim()}` : ''}.`,
  })

  const blocked = items.some(i => i.state === 'fail')
  if (repo.url) {
    const res = await fetch(repo.url).catch(() => null)
    items.push({ id: 'app', title: 'App starts', state: res && res.status < 500 ? 'ok' : 'fail', detail: res && res.status < 500 ? `Using the dev server already running at ${repo.url}.` : `Nothing answers at ${repo.url}. Start it, or clear the address so Post maker starts the app itself.` })
  } else if (blocked) {
    items.push({ id: 'app', title: 'App starts', state: 'fail', detail: 'Fix the items above first; then it tries a start.' })
  } else {
    try {
      const app = await startApp(repo)
      app.stop()
      items.push({ id: 'app', title: 'App starts', state: 'ok', detail: `"${pm} run dev" started and answered at ${app.url}.` })
    } catch (e) {
      items.push({ id: 'app', title: 'App starts', state: 'fail', detail: (e as Error).message })
    }
  }

  const scripts = Object.keys((JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {})
  const seed = scripts.find(n => /(^|:)(seed|demo|fixtures?)(:|$)/i.test(n))
  items.push({
    id: 'data', title: 'Demo data',
    state: repo.dataReady ? 'ok' : 'warn',
    detail: repo.dataReady
      ? 'Set up. Reads use the account and data saved in Post maker’s Chrome profile for this product.'
      : 'Screens show whatever the signed-in account holds. An empty account gives empty screens, which make weak posts.',
    fix: seed ? { label: `run ${pm} run ${seed}`, action: `seed:${seed}` } : undefined,
    steps: repo.dataReady ? undefined : [
      seed ? `Run ${pm} run ${seed} to load the repo's own sample data, or set it up by hand:` : 'Set it up by hand once; it is kept for every read after:',
      'Click “open the app”. A Chrome window opens on your local app, using Post maker’s own profile for this product.',
      'Sign in with a test account, or use the app’s demo button if it has one.',
      'Add a few realistic things a customer would have: real-sounding names, a handful of items, some in each state.',
      'Close the window. Post maker keeps that sign-in and reads those screens from now on.',
    ],
  })

  const broken = (repo.flows ?? []).filter(f => !f.ok)
  items.push({
    id: 'flows', title: 'Flows',
    state: !repo.flows ? 'warn' : broken.length ? 'warn' : 'ok',
    detail: !repo.flows ? 'Not recorded yet. Each read plans flows through the app, records them, and leaves out any that break.'
      : broken.length ? `Last read recorded ${repo.flows.length - broken.length} of ${repo.flows.length}. Left out: ${broken.map(f => `"${f.title}"${f.note ? ` (${f.note})` : ''}`).join('; ')}.`
      : `Last read recorded all ${repo.flows.length}: ${repo.flows.map(f => f.title).join(', ')}.`,
  })

  items.push({
    id: 'login', title: 'Sign-in',
    state: repo.login ? 'ok' : 'warn',
    detail: repo.login ? `Test account ${repo.login.user}, saved on this Mac.` : 'No test account. If the sign-in screen has a demo or guest button, that is used; otherwise only pages without sign-in are read.',
  })
  return items
}

export async function fix(repo: Repo, action: string, values?: Record<string, string>, file?: string) {
  const pm = packageManager(repo.path)
  if (action === 'deps') return sh(`${pm} install`, repo.path, 600_000)
  if (action === 'ffmpeg') return sh('brew install ffmpeg', repo.path, 900_000)
  if (action === 'compose') return sh('docker compose up -d', repo.path, 300_000)
  if (action.startsWith('seed:')) {
    const script = action.slice(5)
    const scripts = (JSON.parse(readFileSync(join(repo.path, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {}
    if (!scripts[script]) throw new Error('That script is not in package.json.')
    const r = await sh(`${pm} run ${script}`, repo.path, 600_000)
    if (!r.code) repo.dataReady = true
    return r
  }
  if (action === 'env' && values && file) {
    const target = join(repo.path, file)
    if (relative(repo.path, target).startsWith('..')) throw new Error('That env file is outside the repo.')
    const lines = Object.entries(values).filter(([k, v]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && v && !/[\r\n]/.test(v))
      .map(([k, v]) => `${k}=${/[\s#"']/.test(v) ? JSON.stringify(v) : v}`)
    const before = existsSync(target) ? readFileSync(target, 'utf8') : ''
    appendFileSync(target, (before && !before.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n', { mode: 0o600 })
    return { code: 0, out: `Added ${lines.length} to ${file}.` }
  }
  throw new Error('Unknown fix.')
}
