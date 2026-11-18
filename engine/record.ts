// Records flows through the locally running app as real video: a visible cursor moves to each
// element, typing is shown key by key, and each step's caption is timed to the recording.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright-core'
import type { Flow, FlowStep, PageOutline } from '../shared/types.ts'
import { chromePath, profileDir, sh } from './shell.ts'

const SIZE = { width: 1280, height: 800 }
// The engine refuses these even if a plan asks: the app holds a person's local data.
const UNSAFE = /delete|remove|archive|sign ?out|log ?out|cancel|unsubscribe|pay|purchase|buy|upgrade|invite|billing|stop|close|recall|send back|reject|revoke|disconnect|reset|deactivate/i

// Runs in the page: what a person can use on it, as short lines like `button "New"`.
export function outlineOf(): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const el of Array.from(document.querySelectorAll('a[href], button, [role="button"], input, textarea, select, [role="tab"], [role="menuitem"]'))) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue
    const input = el as HTMLInputElement
    const tag = el.tagName.toLowerCase()
    const kind = tag === 'a' ? 'link' : tag === 'input' ? (input.type === 'checkbox' ? 'checkbox' : 'textbox') : tag === 'textarea' ? 'textbox' : tag === 'select' ? 'select' : el.getAttribute('role') ?? 'button'
    const labelled = input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent : null
    const name = (el.getAttribute('aria-label') || labelled || input.placeholder || (el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!name) continue
    const line = `${kind} "${name}"`
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
    if (out.length >= 50) break
  }
  return out
}

async function cursorTo(page: Page, box: { x: number; y: number; width: number; height: number }) {
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById('__pm_cursor')
    if (c) { c.style.transform = `translate(${x}px, ${y}px)` }
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await page.waitForTimeout(650)
}

// Finds an element by what a person sees: its role and name, its label, placeholder or text.
async function find(page: Page, target: string, fill: boolean) {
  const name = target.replace(/^(button|link|textbox|checkbox|select|tab|menuitem) /, '').replace(/^"|"$/g, '')
  const candidates = fill
    ? [page.getByLabel(name, { exact: true }), page.getByPlaceholder(name, { exact: true }), page.getByRole('textbox', { name }), page.getByPlaceholder(name)]
    : [page.getByRole('button', { name, exact: true }), page.getByRole('link', { name, exact: true }), page.getByRole('tab', { name }), page.getByRole('menuitem', { name }), page.getByRole('checkbox', { name }), page.getByRole('button', { name }), page.getByRole('link', { name }), page.getByText(name, { exact: true })]
  for (const c of candidates) {
    const first = c.first()
    if (await first.count() && await first.isVisible().catch(() => false)) return first
  }
  throw new Error(`could not find "${name}" on ${new URL(page.url()).pathname}`)
}

async function step(page: Page, origin: string, s: FlowStep) {
  if (UNSAFE.test(s.target)) throw new Error(`refused an unsafe step: ${s.action} "${s.target}"`)
  if (s.action === 'goto') {
    const url = new URL(s.target, origin)
    if (url.origin !== origin) throw new Error('refused a page outside the app')
    await page.goto(url.href, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  } else if (s.action === 'click') {
    const el = await find(page, s.target, false)
    await el.scrollIntoViewIfNeeded()
    const box = await el.boundingBox()
    if (box) await cursorTo(page, box)
    await el.click({ timeout: 8000 })
  } else if (s.action === 'fill') {
    const el = await find(page, s.target, true)
    const box = await el.boundingBox()
    if (box) await cursorTo(page, box)
    await el.click({ timeout: 8000 })
    await el.fill('')
    await el.pressSequentially(s.value, { delay: 45 })
  } else if (s.action === 'press') {
    await page.keyboard.press(s.target || 'Enter')
  }
  await page.waitForTimeout(s.action === 'wait' ? 1500 : 1100)
}

// Headless Chrome's screencast can leave the bottom of each frame unpainted, filled with flat grey (128,128,128).
// Measure where the page really ends on a late frame, so the clip can be cropped to it.
async function paintedHeight(video: string, at: number, dir: string) {
  const raw = join(dir, 'probe.rgb')
  const r = await sh(`ffmpeg -y -loglevel error -ss ${Math.max(0, at).toFixed(2)} -i ${JSON.stringify(video)} -frames:v 1 -f rawvideo -pix_fmt rgb24 ${JSON.stringify(raw)}`, dir, 60_000)
  if (r.code) return SIZE.height
  const px = readFileSync(raw)
  const grey = (x: number, y: number) => { const i = (y * SIZE.width + x) * 3; return px[i] === 128 && px[i + 1] === 128 && px[i + 2] === 128 }
  let y = SIZE.height
  while (y > SIZE.height / 2 && [4, SIZE.width / 2, SIZE.width - 5].every(x => grey(x, y - 1))) y--
  return y - (y % 2)
}

export type Recording = { title: string; why: string; captions: { at: number; cap: string }[]; duration: number; w: number; h: number; mp4: Buffer }

// One attempt: a fresh recording on the product's profile. Fails with the step index and page outline.
async function attempt(productId: string, origin: string, flow: Flow, dir: string) {
  const context = await chromium.launchPersistentContext(profileDir(productId), {
    executablePath: chromePath()!, headless: true, viewport: SIZE, recordVideo: { dir, size: SIZE },
  })
  const opened = Date.now()
  const page = context.pages()[0] ?? await context.newPage()
  // A visible cursor, so viewers can follow what is clicked. Dev overlays are hidden.
  await context.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style')
    s.textContent = `#nuxt-devtools-container, nuxt-devtools-frame, vite-error-overlay, nextjs-portal, astro-dev-toolbar { display: none !important }
      #__pm_cursor { position: fixed; left: -9px; top: -9px; width: 18px; height: 18px; border-radius: 50%; background: rgba(20,20,20,.55); border: 2px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.35); z-index: 2147483647; pointer-events: none; transition: transform .55s cubic-bezier(.3,.7,.2,1); transform: translate(640px, 400px) }`
    document.head.append(s)
    const c = document.createElement('div')
    c.id = '__pm_cursor'
    document.body.append(c)
  }))
  const captions: { at: number; cap: string }[] = []
  let start = 0
  let failed: { at: number; error: string; page: PageOutline } | null = null
  try {
    for (const [i, s] of flow.steps.entries()) {
      // The video starts at the first page, not on a blank tab.
      if (i === 1 && !start) start = (Date.now() - opened) / 1000 - 0.3
      if (s.caption && i > 0) captions.push({ at: Math.max(0, (Date.now() - opened) / 1000 - start), cap: s.caption })
      try { await step(page, origin, s) } catch (e) {
        failed = { at: i, error: (e as Error).message.split('\n')[0]!, page: { path: new URL(page.url()).pathname, title: await page.title(), elements: await page.evaluate(outlineOf).catch(() => []) } }
        break
      }
    }
    await page.waitForTimeout(1200)
  } finally {
    await context.close()
  }
  const video = await page.video()?.path()
  return { failed, video, start, captions, duration: (Date.now() - opened) / 1000 - start }
}

export async function recordFlows(productId: string, origin: string, flows: Flow[], repair: (flow: Flow, failedAt: number, error: string, page: PageOutline) => Promise<FlowStep[] | null>, progress: (l: string) => void) {
  const done: Recording[] = []
  const results: { title: string; ok: boolean; note?: string }[] = []
  const dir = mkdtempSync(join(tmpdir(), 'post-maker-rec-'))
  try {
    for (const flow of flows) {
      progress(`recording "${flow.title}"`)
      let current = flow
      let r = await attempt(productId, origin, current, dir)
      if (r.failed) {
        progress(`"${flow.title}" stopped at step ${r.failed.at + 1}: ${r.failed.error}; asking for a fix`)
        const steps = await repair(current, r.failed.at, r.failed.error, r.failed.page).catch(() => null)
        if (steps) { current = { ...flow, steps }; r = await attempt(productId, origin, current, dir) }
      }
      if (r.failed || !r.video) {
        results.push({ title: flow.title, ok: false, note: r.failed?.error })
        progress(`skipped "${flow.title}"${r.failed ? `: ${r.failed.error}` : ''}`)
        continue
      }
      const out = join(dir, `${done.length}.mp4`)
      const h = await paintedHeight(r.video, r.start + r.duration - 0.6, dir)
      const ff = await sh(`ffmpeg -y -loglevel error -ss ${Math.max(0, r.start).toFixed(2)} -i ${JSON.stringify(r.video)} -vf crop=${SIZE.width}:${h}:0:0 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart -an ${JSON.stringify(out)}`, dir, 300_000)
      if (ff.code) { results.push({ title: flow.title, ok: false, note: 'ffmpeg failed' }); progress(`skipped "${flow.title}": ffmpeg failed`); continue }
      done.push({ title: current.title, why: current.why, captions: r.captions, duration: r.duration, w: SIZE.width, h, mp4: readFileSync(out) })
      results.push({ title: flow.title, ok: true })
      progress(`recorded "${flow.title}", ${Math.round(r.duration)}s`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  return { recordings: done, results }
}
