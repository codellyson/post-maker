import type { Flow, PageOutline } from '#shared/types'

// The desktop engine asks what to record (pages in), or how to fix a flow that failed (repair in).
export default defineEventHandler(async (event) => {
  const productId = await ownProduct(event, getRouterParam(event, 'id'))
  const b = await body<{ pages?: PageOutline[]; repair?: { flow: Flow; failedAt: number; error: string; page: PageOutline } }>(event, 200_000)
  const env = envOf(event)
  if (b.repair) return { steps: await repairFlow(env, b.repair.flow, b.repair.failedAt, String(b.repair.error).slice(0, 500), b.repair.page) }
  const pages = (b.pages ?? []).slice(0, 20).map(p => ({ path: String(p.path).slice(0, 200), title: String(p.title).slice(0, 120), elements: (p.elements ?? []).slice(0, 50).map(e => String(e).slice(0, 120)) }))
  if (!pages.length) throw createError({ statusCode: 400, statusMessage: 'Send the pages read.' })
  return { flows: await planFlows(env, productId, pages) }
})
