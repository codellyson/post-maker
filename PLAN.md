# Post maker build plan

Scope chosen by the owner on 18 November 2026: everything in the mock (mock/index.html). Stack: Nuxt 4 on Cloudflare Workers, the same setup as Smalbum. Design: DESIGN.md (Metro tiles). Product truth: PRODUCT.md.

## Architecture

- **App:** Nuxt 4 SPA (`ssr: false`), Nitro `cloudflare_module`, Tailwind v4 with DESIGN.md tokens. No component library: the Metro world is hand-built.
- **Data:** D1 (`DB`) for users, workspaces, products, posts and the posted log. R2 (`MEDIA`) for screenshots and rendered images.
- **Sign-in:** email codes, copied from Smalbum (`login_codes`, `sessions`, `send_email`). A workspace is a team. Members are invited by email.
- **Background jobs:** a Queue (`JOBS`) runs the slow work so no request waits on it:
  - `read-product`: Browser Rendering opens the site and cuts out the screens.
  - `write-posts`: the AI writes today's posts.
  - `render`: Browser Rendering screenshots a post's render page to PNG or PDF.
  The UI polls job status from D1.
- **Daily:** a cron trigger at 06:00 UTC queues `write-posts` for every product that has no posts for today.
- **Site reader:** `@cloudflare/puppeteer` on the `BROWSER` binding. It opens the URL and same-origin pages (up to 12), collects visible text, and finds candidate visuals (illustrations, figures, product UI, large images), then screenshots each element by itself (the lesson from the Passalong pack: cut out elements, never crop page screenshots). It reads brand colours and fonts from computed styles. Demo login is optional: it fills the first email/password form. Credentials are stored encrypted with AES-GCM under a `CRED_KEY` secret.
- **Writer:** one provider-agnostic interface (`server/ai/`), `writeJson(schema, system, content)`. The default adapter is Anthropic: `@anthropic-ai/sdk` with model `claude-opus-5-5`, structured outputs (`zodOutputFormat`), effort `high`, the product memory cached in the system prompt, and the cut-out screens sent as images so the model can choose visuals. The provider and model come from env (`AI_PROVIDER`, `AI_MODEL`). The writer drafts 6 to 8 angles, then a second call runs the quality check: it drops weak ones with a reason, flags example details, and keeps the best 3 to 5 ranked.
- **Post visuals:** rendered from structured specs (carousel slides, clip frames, close-up image) by the `/render/:post` page, in the product's own brand (its colours, its fonts, its real screens). Downloads:
  - PNG per size and PDF carousels come from Browser Rendering.
  - Clip MP4 is encoded in the browser with WebCodecs from rendered frames, with crossfade and a slow zoom.
- **Never posts.** No platform APIs. Copy and download only.

## Phases

1. Scaffold, design tokens, app shell (rail, pivot header), sign-in, workspace, D1 schema, products CRUD.
2. Site reader: queue, Browser Rendering, R2 shots, and the "what it knows" page with editable memory and voice rules.
3. Writer: AI adapter, prompts, quality check, dropped list; the today screen with live tiles, the open post, feed previews, copy, approve, mark posted; the posted log; the daily cron.
4. Visuals: the render page, PNG and PDF downloads, browser-side MP4 for clips.
5. Team invites, rate limits, error states, deploy (domain to confirm with the owner).

## Owner actions needed (never done by Claude)

- `wrangler secret put ANTHROPIC_API_KEY` and `CRED_KEY`.
- Workers Paid plan for Browser Rendering and Queues, if not already on it.
- Approving resource creation (D1, R2, Queue) and the first deploy.

## Status (18 November 2026)

- Built: phases 1 to 3 and most of 5.
  - Sign-in, workspaces and invites.
  - Products: add, read, edit memory and voice rules, demo login, delete.
  - Site reader (Browser Rendering) and writer (Anthropic, quality check, dropped list).
  - Today (live tiles, feed previews with in-place editing, approve, mark posted), products, what it knows, posted log, team.
  - Daily cron and queue consumer.
- Verified locally against seeded Passalong data (`node scripts/seed-dev.mjs <email>` after signing in once). All screens and the approve and posted flows work. Server and app typecheck clean.
- Not run yet:
  - Reading a real site and writing real posts. Both need `ANTHROPIC_API_KEY` in `.dev.vars` and a Cloudflare account with Browser Rendering (the binding is remote in dev).
  - Server-side refusal fallbacks are not enabled on the AI calls yet.
- Phase 4 done (18 November): downloads are made in the browser from the same visual as the preview (html-to-image, no server render).
  - Images: copy to clipboard, PNG at the platform size, story PNG.
  - Carousels: a PDF for LinkedIn, plus all slides as a zip of PNGs.
  - Clips: an H.264 MP4 (WebCodecs + mp4-muxer) with a slow push-in and cross-fades.
  - All checked headless: right sizes, real fonts and screens.
- Next: Cloudflare setup and first deploy (owner actions above), then a real end-to-end run on a live product.

## Local run on passalong.dev (18 November 2026)

- Site reading works on localhost through the remote browser.
  - It read 12 pages and skipped 3 sign-in pages (no demo login given).
  - It cut out 5 finished illustrations with sensible labels.
  - It read the orange accent, Geist and the dark ground.
- The first version of the reader gave poor results, so it was reworked:
  - waits for each element's entrance animation before capturing it
  - skips blocks that carry prose
  - ignores query-string links such as the theme switch
  - skips non-HTML pages and sign-in walls
  - picks the brand accent by saturation
  - saves the screens before the AI step
- Known flaw: a looping hero animation can be caught mid-move.
- With the key added, the whole loop ran locally.
  - Learning: an accurate summary, and voice rules that match Passalong's own guide (its nouns, British spelling, honest limits, two-part headlines).
  - Writing: 7 ideas, then the quality check kept 5 and dropped 2 with fair reasons. Took about 2.5 minutes. Copy is in the brand voice, platform-specific, with a disclosure on Reddit.
- Fixed after the first write:
  - Flags were long notes from the editor to the writer. They are now one sentence, only for facts a person must confirm.
  - One X post lacked the link. X and LinkedIn now always end with it.
  - A second batch confirmed both fixes, with no repeated angles.
- Today and a carousel PDF were checked with the real posts: AI copy, real screens, the learned brand.
- Open:
  - "More ideas" appends, so a day can grow past the 3 to 5 best (10 after one press).
  - A looping hero animation can be caught mid-move.

## Second product: Squeeze (18 November 2026)

- First failure: the reader waited for network silence, and a live 3D app never goes quiet. Pages now wait for load plus a short beat.
- Learned voice: very good (dry short lines, the workshop joke played straight, "gzip" and "in your browser" named plainly).
- Copy: good, dropped 2 near-duplicates.
- Weakness: a one-page app gave only 1 screen (the idle scene). Clips said "carried to the press", "crushed" over the same idle image.
  - Prompt fixed: a caption must match its screen, and moments no screen shows become text frames. Not re-run yet.
- Product gap: the moments that sell an interactive app need interaction (dropping files) that reading a link cannot trigger. Candidate fix: let the team add their own screenshots or a short screen recording on "what it knows".

## Team uploads (18 November 2026)

- On "what it knows", "add your own screenshots" takes PNG, JPEG or WebP, up to 8 MB each and 40 per product.
  - The file type is checked from the bytes.
  - Each screen can be renamed, switched off or removed. The writer reads the name.
  - Uploads are marked "added by the team", survive a re-read, and are offered to the writer first.
- Screens are served by id at /api/shots/:id/image (migration 0002 adds source, mime and added_by).
- Verified on Squeeze with 4 real mid-action screenshots uploaded through the UI. The next write matched every caption to its screen, used text-only frames where no screen fits, and never reused a screen within a post.

## Desktop app for local repos (planned, 18 November 2026)

Its own Tauri app, built like Ultimate Tester: a thin Tauri window around a local Node engine. The window loads the Post maker web app; when the engine is running, the product page shows a "local repo" section. AI stays on the server, so the Anthropic key never reaches a laptop. The engine authenticates with an access key pasted once from the web app.

### Setup check (runs when a repo is added, and again before every recording)

Nothing records until every item is green. Each item says what is wrong and offers the fix.

1. **Tools:** Chrome found; ffmpeg found (offers `brew install ffmpeg`, run only on the user's click); Node and the repo's package manager, read from its lockfile.
2. **Dependencies:** installed, or an "install" button that runs the package manager.
3. **Env vars:** keys in `.env.example` (or `.env.sample`) compared with `.env` / `.env.local`; missing ones listed and filled in on screen. Values stay on the machine, in the repo's local env file; they are never uploaded.
4. **Database and services:** detected from `docker-compose`, Prisma or `DATABASE_URL`; checks each one answers, and says what to start if not.
5. **App starts:** a trial start on a free port, waiting until the page loads; on failure, the last log lines. Option to point at a dev server the user already runs.
6. **Sign-in:** if the app needs one, a test account saved locally for recording.
7. **Flows:** each planned flow dry-runs once; broken ones are marked and left out, and are checked again before each recording.

### Steps (each tested locally on the Passalong repo before the next)

1. Setup check and engine, used from a normal browser first: add repo, setup check, run app, screenshots with the existing reader, commits since the last run, upload. The writer uses the commits.
2. Recorded flows: the server plans flows as steps, the engine records them with Playwright over Chrome (`recordVideo`), ffmpeg converts to MP4, one retry then skip. Clips play the recording, and MP4 download uses it.
3. Tauri shell: folder picker, engine bundled in the `.app`, build.

### Step 1 status (18 November 2026, local only)

Built and run against the Passalong repo:
- Engine in `engine/` (`node engine/server.ts`, port 4710, Node 22.18+ runs the TypeScript directly). Only the web app's origins may call it; writes must be JSON.
- Product page "local repo" section: connect this Mac (makes an access key and hands it to the engine), repo folder, optional running dev server, optional test account, setup check with fixes, read.
- Setup check on Passalong: tools, deps, env (an example value that looks real counts as an optional default), services, branch, app start (`pnpm run dev` on a free port, then stopped), sign-in.
- Read: 92 commits from `origin/master` reached the writer, and all 5 posts written after were about shipped changes.
- Sign-in: when a page shows a sign-in wall and no test account is set, the engine clicks the app's own demo or guest button once (Passalong: "Skip: use a scratch account", on because `DEMO_LOGIN=1` was already in `apps/web/.dev.vars`). Pages under a walled path count as app pages: read first, and shot as a whole screen. Dev overlays are hidden.
- Result: 6 real Passalong app screens (Get started, Work, Folders, Activities, Settings). They are empty states, because a scratch account has no data; a test account with real work in it would give better pictures.
- The setup check warns when the checked-out branch is far behind (the main Passalong checkout is on a branch from 15 October).
- Migration `0003_local_repo.sql` applied locally only.

### Demo data (18 November 2026)

- Each product has its own saved Chrome profile on the Mac (`~/.post-maker/profiles/<product id>`) and a fixed port, so a sign-in and the data behind it last between reads.
- Setup check item "Demo data": if `package.json` has a seed script (`seed`, `db:seed`, `demo`, `fixtures`…) it offers to run it; otherwise it lists the steps and an "open the app" button. That opens the local app in a visible Chrome window on the product's profile; the person signs in, adds realistic data, and closes the window.
- The engine remembers the app's paths (where a sign-in wall appeared) and reads them first; pages that differ only by an id are read once.
- Passalong was seeded through its own API (scratch account: 8 work items across Draft, To do and In progress, a "Web app" folder with 2 documents). The read now gives 8 app screens with real-looking data.
- Dev servers are stopped with SIGTERM, then SIGKILL on the group 3 s later (a Passalong dev server outlived SIGTERM once).
- Not tried yet: the "open the app" window by hand.

### Step 2 status (18 November 2026, local only)

Recorded flows work on Passalong:
- The read lists what can be used on each app page (`button "New"`, `textbox "Search work"`), and the server's AI plans 2 to 4 flows from that list and recent commits (`POST /api/products/:id/flows`). Plans may only use elements on the list, and must not delete, archive, stop, sign out, pay or invite; the engine also refuses those steps itself.
- The engine records each flow on the product's profile with Playwright video: a visible cursor moves to each element, typing shows key by key, and each step's caption is timed to the video. A failed step goes back to the server once for a repair (`repair` in the same endpoint); still failing, the flow is left out and listed in the setup check's "Flows" item.
- ffmpeg trims the blank start, crops the grey strip headless Chrome leaves at the bottom (frames come out 1280×~670), and makes H.264 MP4. Clips upload to `POST /api/products/:id/clips` (migration `0004_clips.sql`, local only) and are served with Range support.
- A new run replaces the clips, except ones a post already uses: those keep playing and leave the writer's list.
- The writer can pick a recording for a clip post (`recording` field); the post then plays the real video with its captions. MP4 download burns the captions in at each size (wide: caption over the video; portrait and story: video on top, caption under it), checked at 1600×900 and 1080×1350.
- First run: 4 of 4 flows recorded (for example: Work board, type "VAT" in search, open the bug, see its progress). The next write picked one recording for a clip post.
- Not done yet: step 3, the Tauri shell.

### Step 3: desktop app (18 November 2026)

- `desktop/` is a Tauri 2 shell built like Ultimate Tester's. The window opens the Post maker web app (`PM_APP_URL` at build time; `http://localhost:3417` until it is deployed) through a small loading page that waits for it.
- On launch the app checks Node (22.18 or newer, found through the user's login shell) and keeps the engine running on 127.0.0.1:4710. An engine already there is used only if its `/health` names it. If Node is missing or old, the product page's "local repo" section says so.
- `stage-engine.sh` copies `engine/` (with `playwright-core`) and the two shared files it imports into the bundle.
- Inside the app, the repo folder field has a native "choose…" picker (dialog plugin; the capability allows the web app's local and live origins).
- Quitting sends the engine SIGTERM; it stops any dev server it started before exiting.
- Build: `cd desktop && cargo tauri build --bundles app`.

## Deploy plan (deployed 19 November 2026)

Target: `https://postmaker.kreativekorna.com`, one Worker named `post-maker`. Claude does nothing remote until the owner says "deploy".

### What already exists on Cloudflare (checked read-only)

- D1 `post-maker` (id in `wrangler.jsonc`): empty, with all 4 migrations still to apply.
- R2 bucket `post-maker-media` and queue `post-maker-jobs`.
- No Worker deployed yet, so no secrets are set.
- Browser Rendering already works from this account (local dev uses it remotely).

### Before deploy (local, no remote change)

1. Add the custom domain to `wrangler.jsonc`: `"routes": [{ "pattern": "postmaker.kreativekorna.com", "custom_domain": true }]`, the same pattern as Smalbum and SaaQuiz.
2. `pnpm typecheck` and `pnpm build` clean.
3. `pnpm preview` (built Worker under `wrangler dev`) and run once end to end: sign in, read a product, write posts, download one image and one clip.

Done 19 November, all passed:
- Route added; typecheck and build clean.
- The built Worker ran on localhost:3417. `wrangler dev` presents requests under the route's hostname, so the sign-in code went through the `EMAIL` binding the way production sends it, not the dev shortcut.
- Reading Squeeze through the queue and remote browser worked.
- Writing Passalong posts took about 3 minutes: 7 ideas, 5 kept. That is well inside the queue consumer's 15-minute limit.
- Approve, mark posted and the posted log work.
- A PNG (520 KB) and a recorded-clip MP4 (10 MB) exported in the browser.
- "Today" follows the UTC day, so just after midnight in Lagos the header still shows yesterday. That is fine for now, since the cron also runs on UTC.

### Deploy (owner says "deploy" first)

1. Owner sets the secrets (Claude never types them):
   - `wrangler secret put ANTHROPIC_API_KEY`
   - `wrangler secret put CRED_KEY`. Use a new key, not the local one: demo logins saved locally can't be read in production and must be entered again.
2. `pnpm db:migrate:remote` applies 0001 to 0004.
3. `pnpm deploy`. The first deploy creates the custom domain, the cron (06:00 UTC) and the queue consumer.
4. `DEV_SHOW_CODE` stays out of production: sign-in codes go by email only.

### Deployed (19 November 2026)

- The owner set `ANTHROPIC_API_KEY` and a new `CRED_KEY` (piped from `openssl rand`, never shown).
- All 4 migrations are applied to remote D1.
- Version `63b8d060` is live at https://postmaker.kreativekorna.com, with the cron and the queue producer and consumer.
- The home page answers 200. The checks below are still to do.
- Sign-in at first failed with "Server Error" because `postmaker.kreativekorna.com` was not set up for Email Sending. Each sending subdomain needs `wrangler email sending enable <subdomain>`; it does not share Smalbum's. Enabled 19 November, and the SPF and DKIM records match Smalbum's.


Second deploy, 19 November 2026: version `1ad3a4c3`. Migration 0005 (`posts.replaced_at`) applied to the remote database first. It shipped:
- a writer prompt built from Product Hunt day winners, and a 7-line editor scorecard
- Facebook copy, and Instagram as an opt-in on each product
- the "all posts" page, which keeps replaced drafts
- the reordered product page, the looping header and the post panel beside the tiles at 1024 px and up
- platform order: Facebook, X, Instagram, Reddit, LinkedIn
- streamed AI calls with a 64k max_tokens limit

### Check after deploy

- Sign in with a real email. The code arrives from `signin@postmaker.kreativekorna.com`, the same sending setup as Smalbum. If email fails, check the domain in Email Sending before anything else.
- Add Passalong by URL, read it, write today's posts, approve one, mark it posted.
- Invite a second person and accept the invite.
- `wrangler tail post-maker` while the queue runs: no errors.
- The next morning: the cron wrote posts for every product. Every product gets AI calls each day, so watch Anthropic usage for the first week.

### Desktop app after deploy

- Rebuild with `PM_APP_URL=https://postmaker.kreativekorna.com cargo tauri build --bundles app`. The engine and the app's capabilities already allow that origin.
- Connect this Mac again from the product page: the old key belongs to localhost.
- The app is unsigned. Teammates must right-click and choose Open the first time. Signing and notarising (Apple Developer account) is a later step, needed before wider sharing.

### Rollback

- `wrangler rollback post-maker` returns to the last version.
- Migrations only add tables, so the old code still runs on the new schema.

## Pipeline (20 November 2026)

- `.github/workflows/ci.yml` runs on every push and pull request: frozen install, typecheck, build, and a Worker dry run.
- A green push to `main` then deploys. It applies D1 migrations first, then builds and deploys the Worker, then runs a smoke test: `/signin` answers and carries `og:image`, and `/api/me` returns 401.
- Deploys run one at a time.
- Pushing to `main` is now the deploy. Push only on the owner's go-ahead, as before.
- `pnpm run deploy` still works by hand as a fallback.
- `.github/workflows/desktop.yml` runs when a `v*` tag is pushed, or when started by hand. It builds `Post maker.app` on a macOS runner against the live site and attaches a zip to a GitHub release. The app is unsigned.

### One-time setup (owner)

1. Cloudflare dashboard → My Profile → API Tokens → Create Token → use the "Edit Cloudflare Workers" template.
2. Add the permission Account → D1 → Edit.
3. Limit the token to this account and create it.
4. GitHub → codellyson/post-maker → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` (the token)
   - `CLOUDFLARE_ACCOUNT_ID` (the account ID that `wrangler whoami` shows)
5. Until the token is set, pushes run the checks and skip the deploy cleanly.

`ANTHROPIC_API_KEY` and `CRED_KEY` stay Worker secrets on Cloudflare and are never put in GitHub.
