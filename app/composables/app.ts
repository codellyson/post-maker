import type { Clip, Job, Post, Product, Shipped, Shot } from '#shared/types'

type Me = { email: string; role: string; workspace: { id: string; name: string } | null; members: { email: string; role: string }[] }

export const useMe = () => useState<Me | null>('me', () => null)
export const useProducts = () => useState<Product[]>('products', () => [])
// The product shown in the pivot header and on Today.
export const useCurrent = () => useState<string | null>('current', () => null)

export async function loadMe() {
  const me = useMe()
  try {
    me.value = await $fetch<Me>('/api/me')
  } catch {
    me.value = null
  }
  return me.value
}

export async function loadProducts() {
  const products = useProducts()
  products.value = await $fetch<Product[]>('/api/products')
  const current = useCurrent()
  if (!current.value || !products.value.some(p => p.id === current.value)) current.value = products.value[0]?.id ?? null
  return products.value
}

export const fillVar = (f: string) => `var(--color-${f})`

// Readable message from a failed $fetch.
export const errorText = (e: unknown) => {
  const err = e as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string }
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || err?.message || 'Something went wrong. Try again.'
}

const toastMsg = () => useState<string | null>('toast', () => null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string) {
  const t = toastMsg()
  t.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.value = null), 2400)
}
export const useToast = toastMsg

// Polls a background job until it ends. Calls `onLine` as new progress lines arrive.
export async function followJob(jobId: string, onLine?: (lines: string[]) => void): Promise<Job> {
  for (;;) {
    const job = await $fetch<Job>(`/api/jobs/${jobId}`)
    onLine?.(job.progress)
    if (job.status === 'done' || job.status === 'failed') return job
    await new Promise(r => setTimeout(r, 1500))
  }
}

export type TodayData = { day: string; posts: Post[]; dropped: { title: string; reason: string }[]; job: Job | null }
export type ProductData = { product: Product; shots: Shot[]; shipped: Shipped[]; clips: Clip[]; job: Job | null }

export const shotUrl = (_productId: string, shotId?: string) => (shotId ? `/api/shots/${shotId}/image` : '')

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied. Paste it in, then mark it posted.')
  } catch {
    toast('Copy is blocked here. Select the text instead.')
  }
}
