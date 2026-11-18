# Post maker

Post maker turns your products into today's best few social posts: carousels, short clips and close-up images in your product's own brand, with copy written for X, LinkedIn, Instagram and Reddit. Your team copies a post, downloads its visual and posts it by hand.

**It never posts for you.** There are no platform APIs and no scheduling, on purpose.

## How it works

1. **Add a product by its link.** Post maker opens the live site, cuts out real product screens, picks up the brand colours and fonts, and learns how the product talks.
2. **Read the repo too (optional).** The desktop app runs the app from your local repo, signs in with a demo account, takes screens of the parts behind sign-in, and records short flows through the app as video. Commits since the last run become "what shipped" for the writer.
3. **Every morning, today's best few.** It writes seven ideas, an editor pass keeps the three to five worth posting, and says why the rest were dropped. Everyone on the team sees the same list, approves posts and marks what went out.

## Parts

| Folder | What it is |
| --- | --- |
| `app/`, `server/`, `shared/` | The web app: Nuxt 4 on Cloudflare Workers, with D1, R2, Browser Rendering and Queues. |
| `engine/` | The local engine: setup check, runs the repo's app, reads screens, records flows (Playwright and ffmpeg). |
| `desktop/` | The desktop app: a Tauri shell that opens the web app and keeps the engine running. |
| `migrations/` | D1 schema. |

AI runs on the server. It is provider-agnostic, with Anthropic as the default (`AI_PROVIDER`, `AI_MODEL`).

## Run it locally

You need Node 22.18 or newer, pnpm, and a Cloudflare account for Browser Rendering.

```bash
pnpm install
```

Create `.dev.vars` with `ANTHROPIC_API_KEY`, `CRED_KEY` (32 random bytes, base64) and `DEV_SHOW_CODE=1`, then:

```bash
pnpm dev
```

The app runs on the port Nuxt picks. With `DEV_SHOW_CODE=1`, the sign-in code fills itself in on localhost.

The engine, for reading a local repo (it also needs Chrome and ffmpeg):

```bash
cd engine && npm install && node server.ts
```

The desktop app (needs Rust and the Tauri CLI):

```bash
cd desktop && cargo tauri build --bundles app
```

## Status

Early. Tested locally; not deployed yet. `PLAN.md` has the build plan and where things stand.

## License

MIT
