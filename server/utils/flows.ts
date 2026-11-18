import { z } from 'zod'
import type { Flow, Memory, PageOutline } from '#shared/types'

const Step = z.object({
  action: z.enum(['goto', 'click', 'fill', 'press', 'wait']),
  target: z.string().describe('goto: a path from the page list, like /hub/work. click: the exact visible text or label of one element from that page\'s list. fill: the exact label or placeholder of a text field. press: a key such as Enter. wait: empty.'),
  value: z.string().describe('fill: the text to type, realistic and short. Otherwise empty.'),
  caption: z.string().describe('the caption shown while this step happens: one short plain sentence a customer understands, e.g. "Drop the bug in as you\'d say it". Empty for a goto that only opens the start page.'),
})
const Plan = z.object({
  flows: z.array(z.object({
    title: z.string().describe('a short lowercase name, 2 to 6 words'),
    why: z.string().describe('one sentence: why this moment makes a good short video post'),
    steps: z.array(Step).describe('4 to 9 steps. Start with a goto. Each step changes something visible.'),
  })).describe('2 to 4 flows, best first'),
})
const Repair = z.object({ fixed: z.boolean(), steps: z.array(Step) })

const RULES = `Rules for every flow:
- Use only paths and element texts that appear in the page lists. Never guess an element.
- Never delete, archive, remove, cancel, stop, close, recall, reject, revoke, disconnect, reset, sign out, pay, buy, upgrade, invite real people or send email. The app is a team member's local copy with demo data; leave it as it was found as far as possible.
- Show what the product does for a customer, in the order they would do it. A good flow ends on a visible result.
- Typed text is short and realistic, in the product's voice.`

export async function planFlows(env: Env, productId: string, pages: PageOutline[]) {
  const p = await env.DB.prepare('SELECT name, memory FROM products WHERE id = ?').bind(productId).first<{ name: string; memory: string }>()
  const memory = JSON.parse(p!.memory) as Memory
  const shipped = (await env.DB.prepare('SELECT subject FROM shipped WHERE product_id = ? AND at > ? ORDER BY at DESC LIMIT 30').bind(productId, Date.now() - 14 * 86400_000).all<{ subject: string }>()).results
  const { flows } = await aiFor(env).json({
    schema: Plan,
    effort: 'medium',
    system: `You plan short screen recordings of ${p!.name} for social video posts. What it does: ${memory.what ?? 'unknown'}. Who uses it: ${memory.who ?? 'unknown'}.\n\n${RULES}`,
    parts: [{ type: 'text', text: `Pages of the running app, each with the elements a person can use:\n\n${pages.map(pg => `${pg.path} (${pg.title})\n${pg.elements.map(e => `  - ${e}`).join('\n')}`).join('\n\n')}${shipped.length ? `\n\nShipped recently (prefer a flow that shows one of these, if the pages allow it):\n${shipped.map(s => `- ${s.subject}`).join('\n')}` : ''}\n\nPlan the flows.` }],
  })
  return flows as Flow[]
}

export async function repairFlow(env: Env, flow: Flow, failedAt: number, error: string, page: PageOutline) {
  const r = await aiFor(env).json({
    schema: Repair,
    effort: 'medium',
    system: `You fix a screen-recording script that failed part way through.\n\n${RULES}`,
    parts: [{ type: 'text', text: `Flow "${flow.title}":\n${flow.steps.map((s, i) => `${i}. ${s.action} "${s.target}"${s.value ? ` = "${s.value}"` : ''}`).join('\n')}\n\nStep ${failedAt} failed: ${error}\n\nThe page at that moment, ${page.path} (${page.title}), has:\n${page.elements.map(e => `- ${e}`).join('\n')}\n\nReturn the whole flow with that step fixed using an element that is really there (fixed: true), or fixed: false if the flow cannot work on this page.` }],
  })
  return r.fixed ? r.steps : null
}
