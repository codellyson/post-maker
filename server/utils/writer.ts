import { z } from 'zod'
import { today, type Memory, type Visual } from '#shared/types'

const Slide = z.object({
  kind: z.enum(['cover', 'shot', 'text', 'cta']),
  headline: z.string().describe('cover and cta: the big line. Wrap one phrase in *asterisks* to set it in the brand accent.'),
  caption: z.string().describe('shot and text slides: one short sentence. cover: the line under the headline. cta: empty.'),
  screen: z.string().describe('shot slides and optionally the cover: the id of a screen from the list. Otherwise empty.'),
})

const Frame = z.object({
  time: z.string().describe('a timestamp like 09:12 when the clip tells a sequence in time, else empty'),
  caption: z.string().describe('the caption burned into this frame, one short sentence'),
  screen: z.string().describe('the id of a screen from the list, or empty for a text-only or code frame'),
  code: z.string().describe('for a frame that shows a command and its result: up to 5 short lines, else empty'),
})

const Draft = z.object({
  pattern: z.string().describe('the post pattern, e.g. "Result first", "The painful moment", "Before and after", "Press one thing", "Like X, for Y", "What it replaces", "Why I built it", "Three steps", "Tip"'),
  title: z.string().describe('a short lowercase name for the post, 2 to 6 words'),
  why: z.string().describe('one sentence for the team: why this post and format should work'),
  hook: z.string().describe('the first line a reader sees'),
  format: z.enum(['carousel', 'clip', 'image']),
  slides: z.array(Slide).describe('carousel only: 4 to 6 slides, starting with a cover and ending with a cta. Empty otherwise.'),
  frames: z.array(Frame).describe('clip only, when no recorded clip fits: 4 to 5 frames. Empty otherwise.'),
  recording: z.string().describe('clip only: the id of a recorded clip from the list, when one shows this post\'s moment. Its own captions are used. Else empty.'),
  imageHeadline: z.string().describe('image only: the headline on the image, with one *accent* phrase. Empty otherwise.'),
  imageScreen: z.string().describe('image only: the screen id to show. Empty otherwise.'),
  x: z.string().describe('the X post, 280 characters at most including the link. Its last line before the link is a short question to the reader or the first thing to try; cut words from the middle to make room.'),
  linkedin: z.string().describe('the LinkedIn post; the first 210 characters must make people click "see more"'),
  facebook: z.string().describe('the Facebook post, written for people who follow the page: conversational, the first 125 characters carry it on a phone; no hashtags'),
  instagram: z.string().describe('the Instagram caption; the first 125 characters carry it; a few relevant hashtags at the end'),
  reddit: z.string().describe('a Reddit post as "Title: ...\\n\\nBody: ..." only when the angle suits a community, else empty'),
  usesExampleDetails: z.string().describe('if the post uses made-up details (times, names, numbers), name them in one short sentence, e.g. "The names and times are a demo; swap in a real case or keep it labelled as a demo." Else empty.'),
})

const Drafts = z.object({ drafts: z.array(Draft) })
const DraftsNoInstagram = z.object({ drafts: z.array(Draft.omit({ instagram: true })) })

const Verdict = z.object({
  keep: z.array(z.object({ index: z.number().int(), flag: z.string().describe('one short sentence, only for a fact a person must confirm in the real world before posting (e.g. a made-up name or time). Never notes about formatting, links, screen ids, scores or what to fix. Usually empty.'), x: z.string().describe('only when this X post fails line 6: the full corrected X post, same text with its last line before the link turned into a question or a first thing to try, 280 characters at most. Else empty.') }))
    .describe('the drafts worth posting, best first, 3 to 5 of them'),
  drop: z.array(z.object({ index: z.number().int(), reason: z.string().describe('one plain sentence: why it is not good enough') })),
})

function system(name: string, url: string, m: Memory) {
  const rules = (m.rules ?? []).map(r => `- ${r.text}${r.source === 'team' ? ' (set by the team: always follow)' : ''}`).join('\n')
  return `You write social posts for ${name} (${url}) for a small team that copies them and posts them by hand.

What it does: ${m.what ?? 'unknown'}
Who it is for: ${m.who ?? 'unknown'}

Voice rules:
${rules || '- Plain, specific, calm.'}

What good looks like:
- Every post names something real the product does. Nothing a competitor could also say.
- Each platform gets its own version, written for how people read there, not one text cut down.
- No hype words, no exclamation marks, no emoji unless the voice rules allow them, no claims the site does not support. Never invent customers, numbers or quotes as if they were real.
- Visuals show the real product: use the screens provided, by id. A carousel is one idea per slide.
- A slide or frame caption must match what its screen actually shows. If no screen shows a moment (an action, a result), make that a text slide or frame instead of pairing it with an unrelated screen. Never use the same screen for two different moments in one post.
- X, LinkedIn and Facebook posts end with the product's link. Instagram says "link in bio" instead.

How launches that win write (from Product Hunt day winners; the quoted lines show the shape only, never reuse their words):
- Lead with the result the reader gets, not the feature or how it works. "Production-ready UI in seconds", not "We added a UI generator".
- Other hooks that work: the painful moment the reader already knows ("You come back from a week off and nobody can tell you where the project is"); the one action to take ("Show it once, let it run"); a known name for the category ("The Vercel for GTM", "Email that feels like chat"); the tool or chore it replaces; a question about the reader's own day ("Your teammate's AI did something today. Do you know what?").
- A thesis line in two short halves that flips how the reader sees the problem: "AI is single-player. Real work is multiplayer." "Email is a conversation that forgot it was one." "Everyone's AI is fast. Almost nobody's team is." Use one when the product has a real point of view; never force it.
- Tell the painful loop as the steps people repeat today ("You prompt, copy the answer into chat, explain it to a teammate, then prompt again"), then one line on what breaks ("The AI got faster, but the team didn't").
- Proof beats claims: the team uses it themselves ("This launch was planned in it"), or it began as a tool the maker built for themselves.
- One rule people can repeat, said the same way every time ("Agents prepare, people approve", "Everything stays on your computer").
- Be honest about limits ("It's far from finished", "That isn't there yet") when it builds trust. Never hide one the site states.
- An update post opens with the user's problem and what the maker noticed ("I kept losing track of who was answering what. So I rebuilt the view around threads."), not the version number.
- One post, one idea. Pick the single sharpest moment and show it; do not tour the features.
- Show the before and after: the messy way people do it today, then the same job with the product.
- Speak like the maker telling a peer why it exists: first person, a real reason, a real detail. Real numbers only if the site states them.
- Answer the doubt a reader will have (privacy, setup time, price, "why not just use X") before they ask.
- Write the middle as what the reader sees or does ("You open the board: the checkout bug is with Sam, handed in an hour ago, waiting for you."), not "In ${name}, X does Y". Name the product at most once in the body. No lists of features.
- The last line before the link is never a feature statement. It is a question to the reader, the first thing to try ("Hand it one bug from your inbox and watch where it goes."), or the honest state of things.
- End with a reason to act or a real question to the reader, never a slogan. A question must be one people want to answer about their own work ("What was the worst part for you?", "If you could see everything your team's AI touched today, would you like what you saw?"). Or give the first two or three things to try.
- Never explain setup, commands, file formats or docs unless the post is a tip for people who already use the product. Readers care what changes for them, not how it is built.
- Visuals: the cover carries the hook as a short result line, and the next slides show the real product. Each slide is one benefit headline of at most two short lines over a large, real screen; a concept the screens cannot show (what connects to what) becomes a simple text slide. A "three steps" slide works when setup is the doubt. Each slide earns its place; cut any slide that only repeats the caption.
- Vary the shape across posts: not every post is hook, list, link.`
}

const SCORECARD = `Score each draft 1 to 10 on each line:
1. Stops the scroll: the first line alone makes the right reader stop (a result, a painful moment, or a sharp action), not a description.
2. One idea: one sharp point, not a feature tour.
3. Specific: names a real moment, screen or detail of this product that a competitor could not post.
4. For the reader: about what changes for them, not how the product works inside.
5. Visual earns it: the cover states the hook and each slide or frame shows something the text cannot.
6. Reason to click: the X post's last line before the link is a question people will answer or a first thing to try. A feature statement there scores 4 at most.
7. Shows, not tells: the middle is what the reader sees or does, not "In the product, X does Y" or a list of features.
Keep only drafts that score 7 or more on every line. Rank by total. If fewer than 3 pass, keep the best 3. When a kept post fails only line 6 on X, write the corrected X post in its x field instead of describing the fix.`

export async function writePosts(env: Env, productId: string, progress: Progress) {
  const db = env.DB
  const p = await db.prepare('SELECT name, url, memory, status FROM products WHERE id = ?').bind(productId).first<{ name: string; url: string; memory: string; status: string }>()
  if (!p) throw new Error('The product was deleted.')
  if (p.status !== 'ready') throw new Error('Read the product first.')
  const memory = JSON.parse(p.memory) as Memory
  const day = today()
  // Team-added screens first: they show moments the site alone can't.
  const shots = (await db.prepare("SELECT id, r2_key, label, source, mime FROM shots WHERE product_id = ? AND use = 1 ORDER BY source = 'read', source = 'local', created_at DESC").bind(productId).all<{ id: string; r2_key: string; label: string; source: string; mime: string }>()).results.slice(0, 12)
  const images = await Promise.all(shots.map(async s => (await env.MEDIA.get(s.r2_key))?.arrayBuffer()))
  // Real screen recordings from the local app make the strongest clips.
  const clips = (await db.prepare('SELECT id, title, why, captions, duration FROM clips WHERE product_id = ? AND use = 1').bind(productId).all<{ id: string; title: string; why: string; captions: string; duration: number }>()).results
  const todays = (await db.prepare('SELECT id, title, rank, status, replaced_at, EXISTS (SELECT 1 FROM postings WHERE post_id = posts.id) AS posted FROM posts WHERE product_id = ? AND day = ?').bind(productId, day).all<{ id: string; title: string; rank: number; status: string; replaced_at: number | null; posted: number }>()).results
  const already = todays.map(r => r.title)
  // A day holds at most 5. Approved or posted ones stay; new ideas replace the untouched drafts, which stay in "all posts" as replaced.
  const held = todays.filter(r => !r.replaced_at && (r.status === 'approved' || r.posted))
  const loose = todays.filter(r => !r.replaced_at && !held.includes(r))
  const slots = 5 - held.length
  if (slots <= 0) throw new Error('Today already has 5 approved or posted posts.')
  const used = (memory.anglesUsed ?? []).slice(-30)
  // What shipped in the last two weeks, from the local repo. Only things a customer can notice belong in a post.
  const shipped = (await db.prepare('SELECT subject, at FROM shipped WHERE product_id = ? AND at > ? ORDER BY at DESC LIMIT 40').bind(productId, Date.now() - 14 * 86400_000).all<{ subject: string; at: number }>()).results
  const ai = aiFor(env)
  const sys = system(p.name, p.url, memory)

  await progress('writing ideas')
  const { drafts } = await ai.json({
    schema: memory.instagram ? Drafts : DraftsNoInstagram,
    system: sys,
    parts: [
      { type: 'text', text: 'Screens you can use, by id:' },
      ...shots.flatMap((s, i) => images[i] ? [{ type: 'text' as const, text: `id ${s.id}: ${s.label}${s.source === 'upload' ? ' (added by the team)' : s.source === 'local' ? ' (from the latest local build)' : ''}` }, { type: 'image' as const, data: images[i]!, mime: s.mime as 'image/png' }] : []),
      ...(clips.length ? [{ type: 'text' as const, text: `Recorded clips (real screen recordings of the app being used), by id. A clip post should use one of these when it fits:\n${clips.map(c => `id ${c.id}: "${c.title}", ${Math.round(c.duration)}s. ${c.why} Captions: ${(JSON.parse(c.captions) as { cap: string }[]).map(x => x.cap).join(' / ')}`).join('\n')}` }] : []),
      { type: 'text', text: `Write 7 different post ideas for today (${day}). Mix formats: at least one carousel, one clip and one image.
Angles used recently, do not repeat them: ${used.map(a => `"${a.title}" (${a.pattern})`).join(', ') || 'none'}.
Already written today: ${already.join(', ') || 'none'}.${shipped.length ? `

Shipped recently, from the code history (newest first). Prefer a post about one of these when a customer would notice it; ignore internal changes:
${shipped.map(c => `- ${new Date(c.at).toISOString().slice(0, 10)}: ${c.subject}`).join('\n')}` : ''}${memory.repo?.readme ? `

From the repo README:
${memory.repo.readme.slice(0, 4000)}` : ''}` },
    ],
  })

  await progress(`checking ${drafts.length} ideas against the voice rules`)
  const verdict = await ai.json({
    schema: Verdict,
    system: sys,
    effort: 'medium',
    parts: [{ type: 'text', text: `You are the team's strict editor. Keep only posts someone would post with at most a small edit; rank them best first. Drop anything generic, off-voice, unsupported by what the product does, or too close to another kept post.

${SCORECARD}

${drafts.map((d, i) => `#${i} [${d.format}] ${d.title}\nhook: ${d.hook}\nvisual: ${d.format === 'carousel' ? d.slides.map(s => s.headline || s.caption).join(' | ') : d.format === 'image' ? d.imageHeadline : d.recording ? `recorded clip ${d.recording}` : d.frames.map(f => f.caption).join(' | ')}\nX: ${d.x}\nLinkedIn: ${d.linkedin}`).join('\n\n')}` }],
  })

  const valid = new Set(shots.map(s => s.id))
  const screen = (id: string) => (valid.has(id) ? id : shots[0]?.id ?? '')
  const visualOf = (d: Omit<z.infer<typeof Draft>, 'instagram'>): Visual => {
    if (d.format === 'carousel') return { format: 'carousel', slides: d.slides.map((s, i) => s.kind === 'cover' ? { kind: 'cover', hl: s.headline, sub: s.caption, shot: valid.has(s.screen) ? s.screen : undefined }
      : s.kind === 'cta' ? { kind: 'cta', hl: s.headline, url: new URL(p.url).host }
      : s.kind === 'shot' ? { kind: 'shot', n: String(i).padStart(2, '0'), cap: s.caption, shot: screen(s.screen) }
      : { kind: 'text', n: String(i).padStart(2, '0'), cap: s.caption }) }
    const rec = d.format === 'clip' ? clips.find(c => c.id === d.recording) : undefined
    if (rec) return { format: 'clip', video: rec.id, frames: (JSON.parse(rec.captions) as { at: number; cap: string }[]).map(c => ({ cap: c.cap, at: c.at })) }
    if (d.format === 'clip') return { format: 'clip', frames: d.frames.map(f => ({ time: f.time || undefined, cap: f.caption, shot: valid.has(f.screen) ? f.screen : undefined, code: f.code || undefined })) }
    return { format: 'image', hl: d.imageHeadline, shot: screen(d.imageScreen) }
  }

  const now = Date.now()
  const start = Math.max(-1, ...todays.map(r => r.rank)) + 1
  const stmts = verdict.keep.slice(0, slots).filter(k => drafts[k.index]).map((k, rank) => {
    const d = drafts[k.index]!
    const copy = { X: k.x || d.x, LinkedIn: d.linkedin, Facebook: d.facebook, ...('instagram' in d && d.instagram ? { Instagram: d.instagram } : {}), ...(d.reddit ? { Reddit: d.reddit } : {}) }
    const flag = d.usesExampleDetails || k.flag || null
    return db.prepare('INSERT INTO posts (id, product_id, day, rank, format, pattern, title, why, flag, hook, copy, visual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId(), productId, day, start + rank, d.format, d.pattern, d.title.toLowerCase(), d.why, flag, d.hook, JSON.stringify(copy), JSON.stringify(visualOf(d)), now)
  })
  const drops = verdict.drop.filter(x => drafts[x.index]).map(x => db.prepare('INSERT INTO dropped (id, product_id, day, title, reason) VALUES (?, ?, ?, ?, ?)')
    .bind(newId(), productId, day, drafts[x.index]!.hook, x.reason))
  if (!stmts.length) throw new Error('The quality check kept nothing today. Try again, or add voice rules so it knows what good looks like.')
  const kept = verdict.keep.slice(0, slots).map(k => drafts[k.index]).filter(Boolean).map(d => ({ title: d!.title, pattern: d!.pattern, day }))
  memory.anglesUsed = [...(memory.anglesUsed ?? []), ...kept].slice(-60)
  const swap = loose.map(r => db.prepare('UPDATE posts SET replaced_at = ? WHERE id = ?').bind(now, r.id))
  await db.batch([...swap, ...stmts, ...drops, db.prepare('UPDATE products SET memory = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(memory), now, productId)])
  await progress(`kept ${stmts.length}, dropped ${drops.length}`)
}
