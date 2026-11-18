// Local dev only: seeds a signed-up user's workspace with Passalong, its cut-out screens and today's posts,
// so the screens can be checked without an AI key or Browser Rendering.
// Usage: node scripts/seed-dev.mjs you@example.com   (sign in once first, so the user and workspace exist)
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const email = process.argv[2]
if (!email) throw new Error('usage: node scripts/seed-dev.mjs you@example.com')
const sql = (q) => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'post-maker', '--local', '--json', '--command', q], { encoding: 'utf8' }))[0].results
const esc = (s) => `'${String(s).replace(/'/g, "''")}'`

const [ws] = sql(`SELECT m.workspace_id FROM members m JOIN users u ON u.id = m.user_id WHERE u.email = ${esc(email)}`)
if (!ws) throw new Error('Sign in once with that email first.')
const W = ws.workspace_id
const P = 'seedpassalong1'
const day = new Date().toISOString().slice(0, 10)
const shots = { work: 'seedshotwork1', sorted: 'seedshotsort1', asks: 'seedshotasks1', docs: 'seedshotdocs1' }
const files = { work: 'shot-work-list.png', sorted: 'shot-sorted.png', asks: 'shot-agent-asks.png', docs: 'shot-project-docs.png' }

for (const [k, id] of Object.entries(shots)) {
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `post-maker-media/shots/${P}/${id}.png`, '--local', '--file', `mock/${files[k]}`, '--content-type', 'image/png'], { stdio: 'ignore' })
}

const memory = {
  what: 'Sorts everything a team gets (emails, bug reports, alerts, screenshots) to the right person or AI agent as it arrives, and follows it until it is done with evidence a person can check.',
  who: 'Leads of small teams, developers running AI coding agents, and support or marketing people who never open a terminal.',
  brand: { colours: ['rgb(27, 25, 22)', 'rgb(240, 118, 79)', 'rgb(243, 239, 233)', 'rgb(210, 74, 34)'], fonts: ['Inter'] },
  rules: [
    { text: 'Plain, exact, calm. Say what it does, not how it feels.', source: 'learned' },
    { text: 'British spelling. Sentence case.', source: 'learned' },
    { text: 'Name only Claude Code, Codex, ChatGPT and Claude.', source: 'team', by: email },
    { text: 'Never state a price.', source: 'team', by: email },
  ],
  anglesUsed: [],
  pages: 12,
}

const posts = [
  { format: 'carousel', pattern: 'How it works, in 5 slides', title: 'work arrives in six places', why: 'Carousels get the most reach on LinkedIn and Instagram right now. One step per slide, each on the real product.', hook: 'Your team gets work from six places. Here’s how it all lands in one.', flag: null,
    visual: { format: 'carousel', slides: [
      { kind: 'cover', hl: 'Your team gets work from *six places.*', sub: 'Here’s how it all lands in one. Swipe.', shot: shots.work },
      { kind: 'shot', n: '01', cap: 'Everything comes in: the hub, email, your phone, alerts.', shot: shots.work },
      { kind: 'shot', n: '02', cap: 'Each one gets a clear title and goes to the right person.', shot: shots.sorted },
      { kind: 'shot', n: '03', cap: 'An agent takes it, and asks when it needs an answer.', shot: shots.asks },
      { kind: 'cta', hl: 'Nothing gets *dropped.*', url: 'passalong.dev' },
    ] },
    copy: { LinkedIn: 'Your team gets work from six places. Most small teams drop some of it without noticing.\n\nHere’s how Passalong makes all of it land in one place, in 5 slides.\n\n1. A line in the hub, a forwarded email, a screenshot from your phone, an alert. Each becomes work.\n2. Passalong reads each one, gives it a title anyone can read and sends it to the right person or agent.\n3. An agent takes it, reports as it goes, and asks when it needs an answer.\n4. It hands in with evidence, and a person approves it.\n\npassalong.dev', Instagram: 'Your team gets work from six places. Here’s how it all lands in one. Swipe through.\n\nLink in bio.\n\n#smallteams #aiagents #devtools', X: 'Your team gets work from six places. Here’s how Passalong makes it land in one:\n\npassalong.dev' } },
  { format: 'clip', pattern: 'Demo highlight', title: 'can’t log in, to fixed', why: 'Short clips of the product doing one thing are the most shared launch format. Captions are burned in, so it works on mute.', hook: 'A customer emails: “the reset link says expired”.', flag: 'The times are an example. Swap in a real fix from this week before posting.',
    visual: { format: 'clip', frames: [
      { time: '09:12', cap: 'Kemi emails: she can’t log in. Passalong sorts it.', shot: shots.sorted },
      { time: '09:13', cap: 'It lands on the board, ready for an agent.', shot: shots.work },
      { time: '09:40', cap: 'The agent finds the cause and asks Leo one question.', shot: shots.asks },
      { time: '10:05', cap: 'It hands in what it ran and what came back.', code: '$ pnpm test auth\n✓ reset link valid for 60 min\n✓ 31 passed (2.4s)' },
      { time: '10:10', cap: 'Leo approves it. Kemi is back in.', shot: shots.docs },
    ] },
    copy: { X: 'Kemi emails support: "the reset link says expired".\n\nAn agent finds the cause, asks one question, fixes it and shows its work. Leo approves it.\n\nThe whole path, in 12 seconds:', LinkedIn: 'A customer emails support: "I can’t get into my account, the reset link says expired".\n\n09:12 Passalong turns the email into work.\n09:40 An agent finds the cause and asks one question. Leo answers.\n10:05 It hands in the command it ran and what came back.\n10:10 Leo approves it.\n\npassalong.dev', Instagram: 'Forward the email. Get back the fix.\n\nLink in bio.\n\n#customersupport #aiagents' } },
  { format: 'image', pattern: 'One feature, one line', title: 'agents ask. people decide.', why: 'One idea, one close-up. Works on X, where people scroll fastest.', hook: 'Your agent hits a choice it shouldn’t make alone. It asks.', flag: null,
    visual: { format: 'image', hl: 'Agents ask. *People decide.*', shot: shots.asks },
    copy: { X: 'Your agent hits a choice it shouldn’t make alone: keep old reset links working?\n\nIn Passalong it asks, waits for a person, and carries on once someone answers.\n\npassalong.dev', LinkedIn: 'The risky moment with an AI agent isn’t the code. It’s the decision it makes without asking.\n\nIn Passalong, an agent that reaches a real choice asks, waits, and carries on once someone on the team answers.\n\npassalong.dev', Instagram: 'Agents ask. People decide.\n\nLink in bio.' } },
  { format: 'image', pattern: 'Show the mechanism', title: 'your product, written down', why: 'Shows the part of Passalong nobody else has: projects that remember the product for every agent.', hook: 'Every agent reads what your product is before it starts.', flag: null,
    visual: { format: 'image', hl: 'Agents that read *the brief first.*', shot: shots.docs },
    copy: { LinkedIn: 'Most AI agents start every job from zero.\n\nIn Passalong, each product has a project: what it is, who uses it, how it’s built. Any agent reads it before it starts.\n\npassalong.dev', X: 'Agents that read the brief first.\n\npassalong.dev' } },
]

const now = Date.now()
const q = [
  `DELETE FROM products WHERE id = '${P}'`,
  `INSERT INTO products (id, workspace_id, name, url, colour, status, memory, read_at, created_at, updated_at) VALUES ('${P}', '${W}', 'passalong', 'https://passalong.dev', 'magenta', 'ready', ${esc(JSON.stringify(memory))}, ${now}, ${now}, ${now})`,
  ...Object.entries(shots).map(([k, id]) => `INSERT INTO shots (id, product_id, r2_key, label, page, w, h, use, created_at) VALUES ('${id}', '${P}', 'shots/${P}/${id}.png', ${esc(k === 'work' ? 'work list' : k === 'sorted' ? 'email sorted' : k === 'asks' ? 'agent asks' : 'project documents')}, 'https://passalong.dev/', 641, 401, 1, ${now})`),
  ...posts.map((p, i) => `INSERT INTO posts (id, product_id, day, rank, format, pattern, title, why, flag, hook, copy, visual, status, created_at) VALUES ('seedpost${i}x', '${P}', '${day}', ${i}, '${p.format}', ${esc(p.pattern)}, ${esc(p.title)}, ${esc(p.why)}, ${p.flag ? esc(p.flag) : 'NULL'}, ${esc(p.hook)}, ${esc(JSON.stringify(p.copy))}, ${esc(JSON.stringify(p.visual))}, 'draft', ${now})`),
  `INSERT INTO dropped (id, product_id, day, title, reason) VALUES ('seeddrop1x', '${P}', '${day}', 'Boost your team’s productivity with AI', 'Generic. Names no feature; could be any product.')`,
]
writeFileSync('.wrangler/seed.sql', q.join(';\n') + ';\n')
execFileSync('npx', ['wrangler', 'd1', 'execute', 'post-maker', '--local', '--file', '.wrangler/seed.sql'], { stdio: 'inherit' })
console.log('Seeded Passalong for', email)
