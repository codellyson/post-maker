/// <reference lib="dom" />
import puppeteer from '@cloudflare/puppeteer'
import type { Browser, Page } from '@cloudflare/puppeteer'
import { z } from 'zod'
import type { Memory } from '#shared/types'
import { markVisuals, painted, readBrand, readText } from '#shared/capture'

const MAX_PAGES = 12
const MAX_SHOTS = 16
const VIEW = { width: 1440, height: 900, deviceScaleFactor: 2 }

type PageRead = { url: string; title: string; text: string }

async function settle(page: Page) {
  // Let entrance animations finish so cut-outs show the resting state.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) }
    scrollTo(0, 0)
  })
  await new Promise(r => setTimeout(r, 2500))
}

async function open(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 4000 }).catch(() => {})
  return res
}

async function tryLogin(page: Page, origin: string, creds: { user: string; pass: string }, progress: Progress) {
  const signin = await page.evaluateHandle(() => Array.from(document.querySelectorAll('a, button')).find(a => /sign ?in|log ?in/i.test(a.textContent ?? '')) ?? null)
  const el = signin.asElement()
  if (el) await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => {}), (el as unknown as { click(): Promise<void> }).click()])
  else await open(page, new URL('/login', origin).href).catch(() => {})
  const user = await page.$('input[type="email"], input[name*="email" i], input[name*="user" i], input[autocomplete="username"]')
  const pass = await page.$('input[type="password"]')
  if (!user || !pass) { await progress('could not find a sign-in form; stayed on public pages'); return false }
  await user.type(creds.user)
  await pass.type(creds.pass)
  await Promise.all([page.waitForNavigation({ timeout: 20000 }).catch(() => {}), pass.press('Enter')])
  const stillThere = await page.$('input[type="password"]')
  await progress(stillThere ? 'the demo login did not work; stayed on public pages' : 'signed in with the demo login')
  return !stillThere
}

const Learned = z.object({
  what: z.string().describe('What the product does, in one or two plain sentences a customer would recognise.'),
  who: z.string().describe('Who uses it, in one sentence.'),
  rules: z.array(z.string()).describe('4 to 6 voice rules learned from how the site itself writes: tone, spelling, words it uses and avoids.'),
  shotLabels: z.array(z.string()).describe('A short lowercase name for each screenshot, in the order given, e.g. "work list".'),
})

export async function readProduct(env: Env, productId: string, progress: Progress) {
  const db = env.DB
  const product = await db.prepare('SELECT id, name, url, memory, creds FROM products WHERE id = ?').bind(productId).first<{ id: string; name: string; url: string; memory: string; creds: string | null }>()
  if (!product) throw new Error('The product was deleted.')
  await db.prepare("UPDATE products SET status = 'reading', need = NULL, updated_at = ? WHERE id = ?").bind(Date.now(), productId).run()
  const origin = new URL(product.url).origin

  let browser: Browser | undefined
  const pages: PageRead[] = []
  const shots: { png: Uint8Array; label: string; page: string; w: number; h: number }[] = []
  let brand: Memory['brand']
  let needLogin = false
  try {
    browser = await puppeteer.launch(env.BROWSER)
    const page = await browser.newPage()
    await page.setViewport(VIEW)
    // Live apps (3D scenes, streams, polling) never go network-quiet, so wait for load and then a short beat.
    await open(page, product.url)
    await progress(`opened ${new URL(product.url).host}`)
    brand = await page.evaluate(readBrand)

    const creds = await openCreds(env, product.creds).catch(() => null)
    if (creds) needLogin = !(await tryLogin(page, origin, creds, progress))

    const queue = [page.url()]
    const seen = new Set<string>()
    const seenShots = new Set<string>()
    const loggedIn = !!creds && !needLogin
    while (queue.length && pages.length < MAX_PAGES) {
      const url = queue.shift()!
      const key = new URL(url).pathname.replace(/\/$/, '') || '/'
      if (seen.has(key)) continue
      seen.add(key)
      if (new URL(page.url()).pathname.replace(/\/$/, '') !== key.replace(/^\/$/, '')) {
        const res = await open(page, url).catch(() => null)
        if (!res || !(res.headers()['content-type'] ?? '').includes('text/html')) continue
      }
      // A sign-in wall says nothing about the product; with no working demo login it is skipped.
      if (!loggedIn && await page.$('input[type="password"]')) { await progress(`skipped ${key}: sign-in needed`); continue }
      await settle(page)
      const t = await page.evaluate(readText)
      pages.push({ url, title: t.title, text: t.text })
      for (const l of t.links) {
        try {
          const u = new URL(l)
          // Query strings are state (theme switches, filters), not new pages.
          if (u.origin === origin && !u.search && !/\.[a-z0-9]{2,4}$/i.test(u.pathname) && !/logout|sign-?out|log-?out/i.test(u.pathname)) queue.push(u.origin + u.pathname)
        } catch {}
      }
      if (shots.length < MAX_SHOTS) {
        for (const c of await page.evaluate(markVisuals)) {
          if (shots.length >= MAX_SHOTS) break
          const sig = `${c.label}`
          if (seenShots.has(sig)) continue
          const handle = await page.$(`[data-pm-shot="${c.i}"]`)
          if (!handle) continue
          // Scroll it into view and let its entrance animation run, so the cut-out shows the finished state.
          await handle.evaluate(el => el.scrollIntoView({ block: 'center' }))
          let ok = false
          for (let k = 0; k < 4 && !ok; k++) { await new Promise(r => setTimeout(r, 1200)); ok = await page.evaluate(painted, c.i) }
          if (!ok) continue
          const box = await handle.boundingBox()
          if (!box) continue
          const png = await handle.screenshot({ type: 'png' }) as Uint8Array
          seenShots.add(sig)
          shots.push({ png, label: c.label, page: url, w: Math.round(box.width), h: Math.round(box.height) })
        }
      }
      await progress(`read ${key} · ${shots.length} screens so far`)
    }
  } finally {
    await browser?.close().catch(() => {})
  }
  if (!pages.length) throw new Error(`Could not open ${product.url}. Check the link works in a browser.`)

  // Keep what the browser found before the AI step, so a failure there doesn't throw the screens away.
  const now = Date.now()
  const ids: string[] = []
  // Only replace what the last read cut out; screens the team added stay.
  const stale = (await db.prepare("SELECT r2_key FROM shots WHERE product_id = ? AND source = 'read'").bind(productId).all<{ r2_key: string }>()).results.map(r => r.r2_key)
  if (stale.length) await env.MEDIA.delete(stale)
  await db.prepare("DELETE FROM shots WHERE product_id = ? AND source = 'read'").bind(productId).run()
  for (const s of shots) {
    const id = newId()
    ids.push(id)
    const key = `shots/${productId}/${id}.png`
    await env.MEDIA.put(key, s.png, { httpMetadata: { contentType: 'image/png' } })
    await db.prepare('INSERT INTO shots (id, product_id, r2_key, label, page, w, h, use, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
      .bind(id, productId, key, s.label, s.page, s.w, s.h, now).run()
  }
  const old = JSON.parse(product.memory) as Memory
  await db.prepare('UPDATE products SET memory = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify({ ...old, brand, pages: pages.length }), now, productId).run()
  await progress(`cut out ${shots.length} screens from ${pages.length} pages`)

  await progress('learning what it does and how it talks')
  const learned = await aiFor(env).json({
    schema: Learned,
    effort: 'medium',
    system: 'You read a software product\'s own website and describe it plainly and exactly, for a team that will write social posts about it. Never invent features, customers or numbers.',
    parts: [
      { type: 'text', text: `Product: ${product.name} (${product.url}). Pages read:\n\n${pages.map(p => `# ${p.title} (${p.url})\n${p.text}`).join('\n\n')}` },
      ...shots.flatMap((s, i) => [{ type: 'text' as const, text: `Screenshot ${i + 1}, from ${s.page}, near "${s.label}":` }, { type: 'image' as const, data: s.png.buffer as ArrayBuffer }]),
      { type: 'text', text: 'Describe the product, its audience and its voice, and name each screenshot.' },
    ],
  })
  for (const [i, id] of ids.entries()) {
    if (learned.shotLabels[i]) await db.prepare('UPDATE shots SET label = ? WHERE id = ?').bind(learned.shotLabels[i], id).run()
  }
  // Team corrections survive a re-read; learned rules are replaced.
  const memory: Memory = {
    ...old,
    what: old.what || learned.what,
    who: old.who || learned.who,
    brand,
    rules: [...(old.rules ?? []).filter(r => r.source === 'team'), ...learned.rules.map(text => ({ text, source: 'learned' as const }))],
    pages: pages.length,
  }
  await db.prepare("UPDATE products SET status = 'ready', memory = ?, need = ?, read_at = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(memory), needLogin ? 'the demo login did not work' : null, now, now, productId).run()
  await progress(`read ${pages.length} pages and cut out ${shots.length} screens`)
}
