// Reads the app running from the local repo, the way the cloud reader reads a live site,
// then sends the screens, the commits since the last run and the README to Post maker.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright-core'
import { markVisuals, painted, readText } from '../shared/capture.ts'
import { startApp } from './setup.ts'
import { outlineOf, recordFlows } from './record.ts'
import type { Flow, FlowStep, PageOutline } from '../shared/types.ts'
import { chromePath, profileDir, sh, type Config, type Repo } from './shell.ts'

const MAX_PAGES = 12
const MAX_SHOTS = 16
type Progress = (line: string) => void

async function open(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'load', timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  return res
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(2500)
}

async function signIn(page: Page, origin: string, login: NonNullable<Repo['login']>, progress: Progress) {
  if (!(await page.$('input[type="password"]'))) {
    const link = page.locator('a, button').filter({ hasText: /sign ?in|log ?in/i }).first()
    if (await link.count()) await link.click().catch(() => {})
    else await open(page, new URL('/login', origin).href).catch(() => {})
    await page.waitForLoadState('load').catch(() => {})
  }
  const user = await page.$('input[type="email"], input[name*="email" i], input[name*="user" i], input[autocomplete="username"]')
  const pass = await page.$('input[type="password"]')
  if (!user || !pass) { progress('could not find a sign-in form; read public pages only'); return false }
  await user.fill(login.user)
  await pass.fill(login.pass)
  await Promise.all([page.waitForLoadState('load').catch(() => {}), pass.press('Enter')])
  await page.waitForTimeout(2000)
  const ok = !(await page.$('input[type="password"]'))
  progress(ok ? 'signed in with the test account' : 'the test account did not sign in; read public pages only')
  return ok
}

const launch = (productId: string, headless: boolean) => chromium.launchPersistentContext(profileDir(productId), {
  executablePath: chromePath()!, headless, viewport: { width: 1440, height: 900 }, deviceScaleFactor: headless ? 2 : 1,
})

async function crawl(start: string, repo: Repo, productId: string, progress: Progress) {
  const context = await launch(productId, true)
  const shots: { png: Buffer; label: string; page: string; w: number; h: number }[] = []
  const outlines: PageOutline[] = []
  try {
    // Dev-only overlays (framework devtools, error badges) are not part of the product.
    await context.addInitScript(() => addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container, nuxt-devtools-frame, vite-error-overlay, nextjs-portal, #__next-build-watcher, astro-dev-toolbar { display: none !important }'
      document.head.append(s)
    }))
    const page = context.pages()[0] ?? await context.newPage()
    const origin = new URL(start).origin
    await open(page, start)
    // A profile set up by a person is already signed in.
    let loggedIn = repo.login ? await signIn(page, origin, repo.login, progress) : !!repo.dataReady
    let triedDemo = false
    // Paths that showed a sign-in wall (now or on an earlier run): everything under them is the app itself.
    const walled: string[] = [...(repo.appPaths ?? [])]
    const queue = [...walled.map(w => origin + w), page.url()]
    const seen = new Set<string>()
    const labels = new Set<string>()
    let pages = 0
    while (queue.length && pages < MAX_PAGES) {
      const url = queue.shift()!
      const key = new URL(url).pathname.replace(/\/$/, '') || '/'
      // Pages that differ only by an id (/g/abc123, /g/def456) show the same screen: read one.
      const pattern = key.replace(/\/[a-z0-9_-]*\d[a-z0-9_-]{5,}/gi, '/:id')
      if (seen.has(pattern)) continue
      seen.add(pattern)
      if ((new URL(page.url()).pathname.replace(/\/$/, '') || '/') !== key) {
        const res = await open(page, url).catch(() => null)
        if (!res || !(res.headers()['content-type'] ?? '').includes('text/html')) continue
      }
      if (!loggedIn && await page.$('input[type="password"]')) {
        if (!walled.includes(key)) walled.push(key)
        // Many apps offer a local-only demo or guest account on their sign-in screen. Use it once.
        const demo = page.locator('button, a').filter({ hasText: /demo|guest|scratch account|try it/i }).first()
        if (!triedDemo && await demo.count()) {
          triedDemo = true
          await demo.click().catch(() => {})
          await page.waitForLoadState('load').catch(() => {})
          await page.waitForTimeout(3000)
          loggedIn = !(await page.$('input[type="password"]'))
          progress(loggedIn ? `signed in with the app's own demo account` : 'the demo account button did not sign in')
        }
        if (!loggedIn) { progress(`skipped ${key}: sign-in needed`); continue }
        if ((new URL(page.url()).pathname.replace(/\/$/, '') || '/') !== key) await open(page, url).catch(() => null)
      }
      await settle(page)
      pages++
      const t = await page.evaluate(readText)
      // A page with little prose is app UI, not an article: the whole screen is the picture,
      // and its links lead to more of the app, so they are read first.
      const appLike = walled.some(w => key === w || key.startsWith(`${w}/`))
        || await page.evaluate(() => Array.from(document.querySelectorAll('main p, main li')).filter(p => (p.textContent ?? '').trim().length > 70).length < 3)
      for (const l of t.links) {
        try {
          const u = new URL(l)
          if (u.origin === origin && !u.search && !/\.[a-z0-9]{2,4}$/i.test(u.pathname) && !/logout|sign-?out|log-?out/i.test(u.pathname)) appLike ? queue.unshift(u.origin + u.pathname) : queue.push(u.origin + u.pathname)
        } catch {}
      }
      if (appLike) outlines.push({ path: key, title: t.title, elements: await page.evaluate(outlineOf) })
      if (appLike && loggedIn && shots.length < MAX_SHOTS) {
        await page.evaluate(() => scrollTo(0, 0))
        const label = (await page.evaluate(() => (document.querySelector('main h1, h1, main h2')?.textContent ?? document.title).trim().slice(0, 80))) || key
        if (!labels.has(label)) {
          labels.add(label)
          shots.push({ png: await page.screenshot({ type: 'png' }), label, page: key, w: 1440, h: 900 })
        }
      }
      if (shots.length < MAX_SHOTS) {
        for (const c of await page.evaluate(markVisuals)) {
          if (shots.length >= MAX_SHOTS) break
          if (labels.has(c.label)) continue
          const el = await page.$(`[data-pm-shot="${c.i}"]`)
          if (!el) continue
          await el.evaluate(n => n.scrollIntoView({ block: 'center' }))
          let ok = false
          for (let k = 0; k < 4 && !ok; k++) { await page.waitForTimeout(1200); ok = await page.evaluate(painted, c.i) }
          const box = ok ? await el.boundingBox() : null
          if (!box) continue
          labels.add(c.label)
          shots.push({ png: await el.screenshot({ type: 'png' }), label: c.label, page: key, w: Math.round(box.width), h: Math.round(box.height) })
        }
      }
      progress(`read ${key} · ${shots.length} screens so far`)
    }
    if (!pages) throw new Error(`Could not read any page at ${start}.`)
    repo.appPaths = walled.slice(0, 5)
  } finally {
    await context.close().catch(() => {})
  }
  return { shots, outlines }
}

// What shipped is the default branch (as of the last fetch), not whatever branch is checked out.
async function commits(repo: Repo) {
  const def = await sh('git symbolic-ref --short refs/remotes/origin/HEAD', repo.path, 15_000)
  const ref = def.code ? 'HEAD' : def.out.trim()
  const known = repo.lastSha && (await sh(`git merge-base --is-ancestor ${repo.lastSha} ${ref}`, repo.path, 15_000)).code === 0
  const range = known ? `${repo.lastSha}..${ref}` : `${ref} --since="14 days ago"`
  const { code, out } = await sh(`git log ${range} --no-merges -n 100 --format=%H%x09%ct%x09%s`, repo.path, 30_000)
  if (code) throw new Error(`git log did not work:\n${out.trim().slice(-400)}`)
  const head = (await sh(`git rev-parse ${ref}`, repo.path, 15_000)).out.trim()
  const list = out.split('\n').map(l => l.split('\t')).filter(p => p.length === 3 && /^[a-f0-9]{40}$/.test(p[0]!))
    .map(([sha, ct, subject]) => ({ sha: sha!, at: Number(ct) * 1000, subject: subject! }))
  return { list, head, ref, since: known ? 'the last run' : '14 days ago' }
}

export async function readLocal(cfg: Config, productId: string, progress: Progress) {
  const repo = cfg.repos[productId]
  if (!repo) throw new Error('No repo set for this product.')
  if (!cfg.base || !cfg.key) throw new Error('This Mac is not connected to Post maker yet.')

  const { list, head, ref, since } = await commits(repo)
  progress(`${list.length} commits on ${ref} since ${since}`)
  const readmeFile = ['README.md', 'readme.md', 'README'].map(f => join(repo.path, f)).find(existsSync)
  const readme = readmeFile ? readFileSync(readmeFile, 'utf8').slice(0, 8000) : ''

  let app: Awaited<ReturnType<typeof startApp>> | null = null
  let shots: Awaited<ReturnType<typeof crawl>>['shots'] = []
  let recordings: Awaited<ReturnType<typeof recordFlows>>['recordings'] = []
  const api = async <T,>(path: string, body: unknown) => {
    const res = await fetch(`${cfg.base}/api/products/${productId}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`Post maker said ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return res.json() as Promise<T>
  }
  try {
    let start = repo.url
    if (!start) {
      progress('starting the app')
      app = await startApp(repo)
      start = app.url
    }
    progress(`opened ${start}`)
    const read = await crawl(start!, repo, productId, progress)
    shots = read.shots
    if (read.outlines.length) {
      progress('planning flows to record')
      const { flows } = await api<{ flows: Flow[] }>('flows', { pages: read.outlines })
      progress(`recording ${flows.length} flows: ${flows.map(f => f.title).join(', ')}`)
      const rec = await recordFlows(productId, new URL(start!).origin, flows, (flow, failedAt, error, page) => api<{ steps: FlowStep[] | null }>('flows', { repair: { flow, failedAt, error, page } }).then(r => r.steps), progress)
      recordings = rec.recordings
      repo.flows = rec.results
    } else progress('no app pages found, so no flows to record')
  } finally {
    app?.stop()
  }

  progress(`sending ${shots.length} screens and ${list.length} commits`)
  const form = new FormData()
  form.set('meta', JSON.stringify({ readme, commits: list, shots: shots.map(({ png: _p, ...s }) => s) }))
  shots.forEach((s, i) => form.set(`shot${i}`, new Blob([new Uint8Array(s.png)], { type: 'image/png' }), `shot${i}.png`))
  const res = await fetch(`${cfg.base}/api/products/${productId}/local`, { method: 'POST', headers: { authorization: `Bearer ${cfg.key}` }, body: form })
  if (!res.ok) throw new Error(`Post maker refused the upload: ${res.status} ${(await res.text()).slice(0, 300)}`)
  if (recordings.length) {
    progress(`sending ${recordings.length} recordings`)
    const clipForm = new FormData()
    clipForm.set('meta', JSON.stringify(recordings.map(({ mp4: _m, ...r }) => r)))
    recordings.forEach((r, i) => clipForm.set(`clip${i}`, new Blob([new Uint8Array(r.mp4)], { type: 'video/mp4' }), `clip${i}.mp4`))
    const cr = await fetch(`${cfg.base}/api/products/${productId}/clips`, { method: 'POST', headers: { authorization: `Bearer ${cfg.key}` }, body: clipForm })
    if (!cr.ok) throw new Error(`Post maker refused the recordings: ${cr.status} ${(await cr.text()).slice(0, 300)}`)
  }
  repo.lastSha = head
  repo.readAt = Date.now()
  progress(`done: ${shots.length} screens, ${recordings.length} recordings and ${list.length} commits are in Post maker`)
}

// Opens the local app in a visible Chrome window on this product's profile, so a person can sign in
// and add realistic data. Whatever they leave there is what later reads show.
export async function openForSetup(cfg: Config, productId: string, progress: Progress) {
  const repo = cfg.repos[productId]
  if (!repo) throw new Error('No repo set for this product.')
  let app: Awaited<ReturnType<typeof startApp>> | null = null
  try {
    let start = repo.url
    if (!start) {
      progress('starting the app')
      app = await startApp(repo)
      start = app.url
    }
    const context = await launch(productId, false)
    const page = context.pages()[0] ?? await context.newPage()
    await page.goto(start).catch(() => {})
    progress('the app is open in a Chrome window: sign in, add some realistic data, then close the window')
    await new Promise<void>((resolve) => {
      context.on('close', () => resolve())
      // Closing the last tab leaves the window open on macOS; treat it as done.
      context.on('page', p => p.on('close', () => { if (!context.pages().length) context.close().catch(() => {}) }))
      page.on('close', () => { if (!context.pages().length) context.close().catch(() => {}) })
      setTimeout(() => context.close().catch(() => {}), 30 * 60_000)
    })
    repo.dataReady = true
    progress('saved: reads now use this sign-in and its data')
  } finally {
    app?.stop()
  }
}
