// Shapes shared by the server and the app.

export const FILLS = ['cyan', 'magenta', 'lime', 'orange', 'purple'] as const
export type Fill = typeof FILLS[number]

export const PLATFORMS = ['Facebook', 'X', 'Instagram', 'Reddit', 'LinkedIn'] as const
export type Platform = typeof PLATFORMS[number]

// Characters shown before the feed cuts the text with "see more" / "more".
export const FOLD: Partial<Record<Platform, number>> = { LinkedIn: 210, Facebook: 125, Instagram: 125 }
export const LIMITS: Record<Platform, number> = { X: 280, LinkedIn: 3000, Facebook: 63206, Instagram: 2200, Reddit: 40000 }

export type Rule = { text: string; source: 'learned' | 'team'; by?: string }

// What Post maker knows about a product. The team can correct any of it.
export type Memory = {
  what?: string
  who?: string
  brand?: { colours: string[]; fonts: string[]; logo?: string }
  rules?: Rule[]
  // Instagram copy is opt-in per product.
  instagram?: boolean
  anglesUsed?: { title: string; pattern: string; day: string }[]
  pages?: number
  // From the local repo, via the desktop app.
  repo?: { readme: string; at: number }
}

export type Slide =
  | { kind: 'cover'; hl: string; sub: string; shot?: string }
  | { kind: 'shot'; n: string; cap: string; shot: string }
  | { kind: 'text'; n: string; cap: string }
  | { kind: 'cta'; hl: string; url: string }

// `at` (seconds) places a caption on a recorded clip's timeline.
export type Frame = { time?: string; cap: string; shot?: string; code?: string; at?: number }

// Headlines may wrap one phrase in *asterisks*; it is set in the brand's accent.
export type Visual =
  | { format: 'carousel'; slides: Slide[] }
  | { format: 'clip'; frames: Frame[]; video?: string } // video: a recorded clip's id
  | { format: 'image'; hl: string; shot: string }

export type Post = {
  id: string
  productId: string
  day: string
  rank: number
  format: Visual['format']
  pattern: string
  title: string
  why: string
  flag: string | null
  hook: string
  copy: Partial<Record<Platform, string>>
  visual: Visual
  status: 'draft' | 'approved'
  approvedBy: string | null
  // A newer run of ideas took its place on Today; it still shows in "all posts".
  replaced: boolean
  postings: { platform: string; by: string; at: number }[]
}

export type Shipped = { sha: string; subject: string; at: number }

export type Product = {
  id: string
  name: string
  url: string
  colour: Fill
  status: 'new' | 'reading' | 'ready' | 'failed'
  need: string | null
  memory: Memory
  hasLogin: boolean
  readAt: number | null
  ready: number
  postedThisWeek: number
  // A read or write still running (started within the hour), so every page can show it is busy.
  job: 'read' | 'write' | null
}

export type Shot = { id: string; label: string; page: string; w: number; h: number; use: boolean; source: 'read' | 'upload' | 'local'; url: string }

export type Job = { id: string; kind: 'read' | 'write' | 'render'; status: 'queued' | 'running' | 'done' | 'failed'; progress: string[]; error: string | null }

export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

// One line of the desktop engine's setup check. Only 'fail' blocks a read.
export type SetupItem = { id: string; title: string; state: 'ok' | 'warn' | 'fail'; detail: string; fix?: { label: string; action: string }; missing?: { file: string; keys: string[] }; steps?: string[] }

// A real screen recording of one flow through the local app.
export type Clip = { id: string; title: string; why: string; captions: { at: number; cap: string }[]; duration: number; w: number; h: number; use: boolean; url: string }

// A flow the engine records: steps a person would take, each with the caption shown while it happens.
export type FlowStep = { action: 'goto' | 'click' | 'fill' | 'press' | 'wait'; target: string; value: string; caption: string }
export type Flow = { title: string; why: string; steps: FlowStep[] }
export type PageOutline = { path: string; title: string; elements: string[] }
