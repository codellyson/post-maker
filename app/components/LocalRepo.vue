<script setup lang="ts">
// The product's local repo, read by the Post maker engine on this Mac: setup check, then a read
// of the locally running app plus the commits that shipped. Shown only when the engine answers.
import type { Clip, SetupItem as Item, Shipped } from '#shared/types'

const props = defineProps<{ productId: string; shipped: Shipped[]; clips: Clip[] }>()
const emit = defineEmits<{ changed: [] }>()
const ENGINE = 'http://127.0.0.1:4710'

const engine = ref<{ connected: boolean; base: string | null } | null>(null)
const repo = ref<{ path: string; url: string; login: string; readAt: number | null } | null>(null)
const form = reactive({ path: '', url: '', user: '', pass: '' })
const editing = ref(false)
const items = ref<Item[] | null>(null)
const checking = ref(false)
const fixing = ref('')
const fixOut = ref('')
const envValues = reactive<Record<string, string>>({})
const lines = ref<string[]>([])
const reading = ref(false)
const readError = ref('')

// Inside the desktop app: a native folder picker, and the reason when the engine can't run.
type Tauri = { core: { invoke<T>(cmd: string): Promise<T> }; dialog: { open(o: { directory: boolean; title: string }): Promise<string | null> } }
const tauri = () => (window as unknown as { __TAURI__?: Tauri }).__TAURI__
const desktop = ref(false)
const engineProblem = ref('')
async function pickFolder() {
  const path = await tauri()?.dialog.open({ directory: true, title: 'Choose the repo folder' }).catch(() => null)
  if (path) form.path = path
}

const call = <T,>(path: string, method = 'GET', body?: unknown) => $fetch<T>(`${ENGINE}${path}`, { method: method as 'GET', body: body as Record<string, unknown> | undefined })
const connected = computed(() => !!engine.value?.connected && engine.value.base === location.origin)
const blocked = computed(() => !items.value || items.value.some(i => i.state === 'fail'))

async function load() {
  desktop.value = !!tauri()
  engine.value = await call<{ connected: boolean; base: string | null }>('/health').catch(() => null)
  if (!engine.value && desktop.value) {
    // The app starts the engine on launch; it can take a few seconds, or be blocked (no Node).
    const status = await tauri()!.core.invoke<string>('engine_status').catch(() => 'starting')
    engineProblem.value = status === 'starting' || status === 'running' ? '' : status
    if (!engineProblem.value) setTimeout(load, 2000)
    return
  }
  if (!connected.value) return
  const r = await call<{ repo: typeof repo.value; jobId: string | null }>(`/repos/${props.productId}`)
  repo.value = r.repo
  if (r.repo) Object.assign(form, { path: r.repo.path, url: r.repo.url, user: r.repo.login, pass: '' })
  editing.value = !r.repo
  if (r.jobId && !reading.value) follow(r.jobId)
}

async function connect() {
  try {
    const { key } = await $fetch<{ key: string }>('/api/keys', { method: 'POST', body: { label: 'desktop app' } })
    await call('/connect', 'POST', { key })
    toast('This Mac is connected.')
    await load()
  } catch (e) { toast(errorText(e)) }
}

async function saveRepo() {
  try {
    await call(`/repos/${props.productId}`, 'PUT', { path: form.path, url: form.url, login: form.user && form.pass ? { user: form.user, pass: form.pass } : form.user ? undefined : null })
    items.value = null
    await load()
    runCheck()
  } catch (e) { toast(errorText(e)) }
}

async function runCheck() {
  checking.value = true
  fixOut.value = ''
  try { items.value = (await call<{ items: Item[] }>(`/repos/${props.productId}/check`, 'POST', {})).items }
  catch (e) { toast(errorText(e)) }
  finally { checking.value = false }
}

async function runFix(action: string, extra: Record<string, unknown> = {}) {
  fixing.value = action
  fixOut.value = ''
  try {
    const r = await call<{ ok: boolean; out: string }>(`/repos/${props.productId}/fix`, 'POST', { action, ...extra })
    fixOut.value = r.out
    await runCheck()
  } catch (e) {
    const err = e as { data?: { out?: string } }
    fixOut.value = err.data?.out ?? errorText(e)
  } finally { fixing.value = '' }
}

async function follow(jobId: string) {
  reading.value = true
  readError.value = ''
  try {
    for (;;) {
      const j = await call<{ status: string; progress: string[]; error: string | null }>(`/jobs/${jobId}`)
      lines.value = j.progress
      if (j.status !== 'running') { if (j.error) readError.value = j.error; break }
      await new Promise(r => setTimeout(r, 1500))
    }
  } finally {
    reading.value = false
    await load()
    emit('changed')
  }
}
async function start(kind: 'read' | 'open') {
  try {
    await follow((await call<{ jobId: string }>(`/repos/${props.productId}/${kind}`, 'POST', {})).jobId)
    if (kind === 'open') await runCheck()
  } catch (e) { toast(errorText(e)) }
}

const mark = { ok: 'bg-lime', warn: 'bg-orange', fail: 'bg-magenta' }
onMounted(load)
</script>

<template>
  <section v-if="!engine && engineProblem" class="mt-10 grid gap-4">
    <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">local repo</h2>
    <p class="m-0 max-w-[68ch] bg-orange px-3.5 py-2.5 font-normal text-black">{{ engineProblem }}</p>
  </section>
  <section v-if="engine" class="mt-10 grid gap-4">
    <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">local repo</h2>

    <div v-if="!connected" class="flex flex-wrap items-center gap-3.5">
      <button class="btn btn-sm" @click="connect">connect this Mac</button>
      <p class="m-0 max-w-[62ch] text-ink-2">The Post maker engine is running here. Connect it to read this product’s repo: screens of the app running on this Mac, and what shipped.</p>
    </div>

    <template v-else>
      <form v-if="editing" class="grid max-w-[760px] gap-2.5" @submit.prevent="saveRepo">
        <label class="grid gap-1"><span class="text-[14px] text-ink-2">repo folder on this Mac</span>
          <span class="flex gap-2.5"><input v-model="form.path" class="input min-w-0 flex-1 !text-[17px]" placeholder="~/code/your-app" required>
            <button v-if="desktop" type="button" class="btn btn-ghost btn-sm flex-none" @click="pickFolder">choose…</button></span></label>
        <label class="grid gap-1"><span class="text-[14px] text-ink-2">dev server already running? its address (optional; else Post maker starts the app)</span>
          <input v-model="form.url" class="input !text-[17px]" placeholder="http://localhost:3000"></label>
        <div class="grid gap-2.5 md:grid-cols-2">
          <input v-model="form.user" class="input !text-[17px]" autocomplete="off" placeholder="test account (optional)" aria-label="Test account">
          <input v-model="form.pass" class="input !text-[17px]" type="password" autocomplete="new-password" :placeholder="repo?.login ? 'saved; type to change' : 'test password'" aria-label="Test password">
        </div>
        <div class="flex gap-2.5"><button class="btn btn-sm">save and check setup</button><button v-if="repo" type="button" class="btn btn-ghost btn-sm" @click="editing = false">cancel</button></div>
      </form>

      <template v-else-if="repo">
        <p class="m-0 flex flex-wrap items-baseline gap-x-3 text-[17px]">
          <span>{{ repo.path }}</span>
          <span class="text-ink-3">{{ repo.url ? `using ${repo.url}` : 'starts the app itself' }}{{ repo.readAt ? ` · last read ${new Date(repo.readAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '' }}</span>
          <button class="text-[14px] text-ink-3 hover:text-cyan" @click="editing = true">change</button>
        </p>

        <section v-if="reading || lines.length" class="grid max-w-[760px] gap-4">
          <JobLines :lines="lines" :running="reading" />
          <p v-if="readError" class="m-0 bg-magenta px-3.5 py-2.5 font-normal whitespace-pre-wrap text-black">{{ readError }}</p>
        </section>

        <template v-if="!reading">
          <div class="flex flex-wrap items-center gap-2.5">
            <button class="btn btn-sm" :disabled="blocked || checking" @click="start('read')">read local app <Icon name="play" /></button>
            <button class="btn btn-ghost btn-sm" :disabled="checking" @click="runCheck">{{ checking ? 'checking… (starting the app can take a minute)' : 'check setup' }}</button>
            <span v-if="!items && !checking" class="text-ink-2">Check the setup first. Nothing reads until every item passes.</span>
          </div>

          <ul v-if="items" class="m-0 grid max-w-[860px] list-none gap-3 p-0">
            <li v-for="i in items" :key="i.id" class="grid grid-cols-[14px_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-2">
              <span class="size-3.5 translate-y-0.5" :class="mark[i.state]" :aria-label="i.state" />
              <div class="grid gap-1.5">
                <p class="m-0 text-[17px]"><b class="font-normal">{{ i.title }}</b> <span class="text-ink-2 whitespace-pre-wrap">{{ i.detail }}</span></p>
                <ol v-if="i.steps" class="m-0 grid max-w-[68ch] gap-1 pl-5 text-[15px] text-ink-2">
                  <li v-for="(st, k) in i.steps" :key="k">{{ st }}</li>
                </ol>
                <div v-if="i.fix || i.id === 'data'" class="flex flex-wrap gap-2.5">
                  <button v-if="i.id === 'data'" class="btn btn-sm" :disabled="!!fixing" @click="start('open')">{{ i.state === 'ok' ? 'open the app again' : 'open the app' }}</button>
                  <button v-if="i.fix" class="btn btn-ghost btn-sm" :disabled="!!fixing" @click="runFix(i.fix.action)">{{ fixing === i.fix.action ? 'working…' : i.fix.label }}</button>
                </div>
                <form v-if="i.missing" class="grid gap-2" @submit.prevent="runFix('env', { file: i.missing.file, values: envValues })">
                  <label v-for="k in i.missing.keys" :key="k" class="grid gap-1 md:grid-cols-[220px_1fr] md:items-center">
                    <span class="text-[14px] text-ink-2">{{ k }}</span>
                    <input v-model="envValues[k]" class="input !py-1.5 !text-[15px]" autocomplete="off">
                  </label>
                  <button class="btn btn-sm justify-self-start" :disabled="!!fixing">save to {{ i.missing.file }}</button>
                </form>
              </div>
            </li>
          </ul>
          <pre v-if="fixOut" class="m-0 max-w-[860px] overflow-x-auto bg-raise p-3 text-[13px] text-ink-2">{{ fixOut }}</pre>
        </template>
      </template>
    </template>

    <div v-if="clips.length" class="grid gap-3">
      <h3 class="m-0 text-[21px] font-light">recorded flows</h3>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
        <figure v-for="c in clips" :key="c.id" class="m-0 grid min-w-0 content-start gap-1.5">
          <video :src="c.url" class="aspect-[16/10] w-full bg-raise" controls muted playsinline preload="metadata" />
          <figcaption class="grid gap-0.5"><span class="text-[17px]">{{ c.title }} <span class="text-ink-3">· {{ Math.round(c.duration) }}s</span></span><span class="text-[14px] text-ink-2">{{ c.captions.map(x => x.cap).join(' → ') }}</span></figcaption>
        </figure>
      </div>
    </div>

    <div v-if="shipped.length" class="grid gap-2">
      <h3 class="m-0 text-[21px] font-light">what shipped, from the code history</h3>
      <ul class="m-0 grid list-none gap-1 p-0 text-[15px]">
        <li v-for="c in shipped.slice(0, 8)" :key="c.sha" class="flex gap-3"><span class="w-[86px] flex-none text-ink-3">{{ new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }}</span>{{ c.subject }}</li>
      </ul>
    </div>
  </section>
</template>
