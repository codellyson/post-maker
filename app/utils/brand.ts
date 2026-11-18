import type { Memory } from '#shared/types'

// Post visuals wear the customer's brand, not Post maker's. Derived from the colours and fonts read off their site.
export type Brand = { ground: string; ink: string; accent: string; font: string; fontUrl?: string }

const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number) as number[]
const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const sat = (c: number[]) => Math.max(...c) - Math.min(...c)
const SYSTEM = /^(system-ui|-apple-system|sans-serif|serif|arial|helvetica|segoe ui|inter var)$/i

export function brandOf(memory: Memory | undefined): Brand {
  const cols = (memory?.brand?.colours ?? []).map(c => ({ c, v: rgb(c) })).filter(x => x.v.length === 3)
  const dark = cols.filter(x => lum(x.v) < 0.06).sort((a, b) => lum(a.v) - lum(b.v))[0]
  const light = cols.filter(x => lum(x.v) > 0.7).sort((a, b) => lum(b.v) - lum(a.v))[0]
  const vivid = cols.filter(x => sat(x.v) > 90 && lum(x.v) > 0.08).sort((a, b) => sat(b.v) - sat(a.v))[0]
  const font = memory?.brand?.fonts?.find(f => f && !SYSTEM.test(f)) ?? 'Inter'
  return {
    ground: dark?.c ?? '#17181c',
    ink: light?.c ?? '#f4f2ee',
    accent: vivid?.c ?? '#00bde3',
    font,
    fontUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`,
  }
}

// "Your team gets work from *six places.*" -> the starred phrase set in the accent.
export const accentHtml = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\*([^*]+)\*/g, '<em>$1</em>')
