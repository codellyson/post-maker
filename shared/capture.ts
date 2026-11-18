/// <reference lib="dom" />
// Functions that run inside the page being read, by the Cloudflare reader and by the desktop engine.
// Keep them self-contained: they are serialised into the page.

export type Candidate = { i: number; label: string }

// Runs in the page. Marks elements worth showing in a post: illustrations, product UI, figures and large images.
// A block that carries prose (a paragraph of sentences) is a section, not a visual: its visual child is picked instead.
export function markVisuals(): Candidate[] {
  const out: (Candidate & { el: Element })[] = []
  const skip = (el: Element) => !!el.closest('nav, header, footer, [role="navigation"], form, dialog') || !!el.querySelector('input[type="password"]')
  const media = (el: Element) => /^(IMG|SVG|CANVAS|VIDEO|PICTURE)$/i.test(el.tagName)
  const visual = (el: Element) => media(el) || el.tagName === 'FIGURE' || !!el.querySelector('img, svg, canvas, video, picture')
  const prose = (el: Element) => Array.from(el.querySelectorAll('p, li, blockquote')).some(p => (p.textContent ?? '').trim().length > 70)
  const label = (el: Element) => {
    const own = el.getAttribute('aria-label') || el.getAttribute('alt') || el.querySelector('img')?.getAttribute('alt')
    if (own) return own
    let n: Element | null = el
    while (n && n !== document.body) {
      const h = n.querySelector('h1, h2, h3, h4')
      if (h && !el.contains(h)) return (h.textContent ?? '').trim().slice(0, 80)
      n = n.parentElement
    }
    return document.title.slice(0, 80)
  }
  let i = 0
  for (const el of Array.from(document.querySelectorAll('main *, body > *:not(header):not(footer):not(nav) *'))) {
    if (out.some(o => o.el === el || o.el.contains(el))) continue
    const r = el.getBoundingClientRect()
    if (r.width < 280 || r.height < 180 || r.width > 1320 || r.height > 1000) continue
    if (skip(el) || !visual(el) || (!media(el) && prose(el))) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    el.setAttribute('data-pm-shot', String(i))
    out.push({ el, i, label: label(el) })
    i++
    if (out.length >= 10) break
  }
  return out.map(({ el: _el, ...c }) => c)
}

// After an element scrolls into view and its entrance animation has had time to run: does it show anything yet?
export function painted(i: number) {
  const el = document.querySelector(`[data-pm-shot="${i}"]`)
  if (!el) return false
  const visible = (n: Element) => { const s = getComputedStyle(n); return s.visibility !== 'hidden' && Number(s.opacity) > 0.85 }
  if (!visible(el)) return false
  if (/^(IMG|SVG|CANVAS|VIDEO|PICTURE)$/i.test(el.tagName)) return true
  return Array.from(el.querySelectorAll('img, svg, canvas, video, *')).some(n => visible(n) && ((n.textContent ?? '').trim().length > 2 || /^(IMG|SVG|CANVAS|VIDEO)$/i.test(n.tagName)) && n.getBoundingClientRect().width > 20)
}

export function readBrand() {
  const count = new Map<string, number>()
  const vivid = new Map<string, number>()
  const add = (c: string, n = 1) => {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent' || c.startsWith('rgba') && /, 0\)$/.test(c)) return
    count.set(c, (count.get(c) ?? 0) + n)
    const v = (c.match(/\d+/g) ?? []).slice(0, 3).map(Number)
    if (v.length === 3 && Math.max(...v) - Math.min(...v) > 90) vivid.set(c, (vivid.get(c) ?? 0) + n)
  }
  for (const el of Array.from(document.querySelectorAll('body *')).slice(0, 2500)) {
    const s = getComputedStyle(el)
    add(s.color)
    add(s.backgroundColor, 2)
    if (el instanceof SVGElement) add(s.fill)
  }
  add(getComputedStyle(document.body).backgroundColor, 50)
  const fonts = [...new Set([document.body, document.querySelector('h1'), document.querySelector('h2')].filter(Boolean)
    .map(el => getComputedStyle(el as Element).fontFamily.split(',')[0]!.replace(/["']/g, '').trim()))]
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c)
  // The brand accent is usually rare but saturated, so it is picked separately from the most common colours.
  const colours = [...new Set([...top(vivid, 2), ...top(count, 5)])]
  const logo = (document.querySelector('link[rel="icon"][type="image/svg+xml"], link[rel="apple-touch-icon"], link[rel="icon"]') as HTMLLinkElement | null)?.href
  return { colours, fonts, logo }
}

export function readText(): { title: string; text: string; links: string[] } {
  const main = document.querySelector('main') ?? document.body
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href)
  return { title: document.title, text: (main as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').slice(0, 6000), links }
}
