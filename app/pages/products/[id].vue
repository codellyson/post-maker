<script setup lang="ts">
const fill = fillVar
const go = navigateTo
import { FILLS, type Rule } from '#shared/types'

const route = useRoute()
const id = computed(() => String(route.params.id))
const data = ref<ProductData | null>(null)
const lines = ref<string[]>([])
const running = ref(false)
const newRule = ref('')
const user = ref('')
const pass = ref('')
const me = useMe()

async function load() {
  data.value = await $fetch<ProductData>(`/api/products/${id.value}`)
  const j = data.value.job
  if (j && (j.status === 'queued' || j.status === 'running') && !running.value) follow(j.id)
  else if (j) lines.value = j.progress
}
async function follow(jobId: string) {
  running.value = true
  try {
    const job = await followJob(jobId, l => (lines.value = l))
    if (job.status === 'failed') toast(job.error ?? 'Reading did not work.')
  } finally {
    running.value = false
    await load()
    loadProducts()
  }
}
async function save(patch: Record<string, unknown>, msg = 'Saved. Every post from now on uses it.') {
  try {
    await $fetch(`/api/products/${id.value}`, { method: 'PATCH', body: patch })
    toast(msg)
    await load()
    loadProducts()
  } catch (e) {
    toast(errorText(e))
  }
}
const rules = computed<Rule[]>(() => data.value?.product.memory.rules ?? [])
function addRule() {
  const text = newRule.value.trim()
  if (!text) return
  save({ rules: [...rules.value, { text, source: 'team', by: me.value?.email }] }, 'Rule added. Every post from now on uses it.')
  newRule.value = ''
}
const removeRule = (k: number) => save({ rules: rules.value.filter((_, i) => i !== k) }, 'Rule removed.')
async function reread() {
  try {
    const { jobId } = await $fetch<{ jobId: string }>(`/api/products/${id.value}/read`, { method: 'POST' })
    follow(jobId)
  } catch (e) {
    toast(errorText(e))
  }
}
async function setUse(shotId: string, use: boolean) {
  await $fetch(`/api/shots/${shotId}`, { method: 'PATCH', body: { use } }).catch(e => toast(errorText(e)))
}
const picker = ref<HTMLInputElement>()
const uploading = ref(0)
const sizeOf = (f: File) => new Promise<{ w: number; h: number }>((res) => {
  const img = new Image()
  img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src) }
  img.onerror = () => res({ w: 0, h: 0 })
  img.src = URL.createObjectURL(f)
})
async function upload(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])]
  uploading.value = files.length
  for (const f of files) {
    const { w, h } = await sizeOf(f)
    const form = new FormData()
    form.append('file', f)
    form.append('w', String(w))
    form.append('h', String(h))
    await $fetch(`/api/products/${id.value}/shots`, { method: 'POST', body: form }).catch(err => toast(errorText(err)))
    uploading.value--
  }
  if (picker.value) picker.value.value = ''
  if (files.length) toast(`Added. Rename each one by what it shows.`)
  await load()
}
const rename = (shotId: string, label: string) => $fetch(`/api/shots/${shotId}`, { method: 'PATCH', body: { label } }).then(() => toast('Renamed.')).catch(e => toast(errorText(e)))
async function removeShot(shotId: string) {
  await $fetch(`/api/shots/${shotId}`, { method: 'DELETE' }).catch(e => toast(errorText(e)))
  await load()
}
async function saveLogin() {
  await save({ user: user.value, pass: pass.value }, 'Demo login saved. Read the site again to use it.')
  pass.value = ''
}
const confirmDelete = ref(false)
async function remove() {
  await $fetch(`/api/products/${id.value}`, { method: 'DELETE' }).catch(e => toast(errorText(e)))
  await loadProducts()
  navigateTo('/products')
}
onMounted(() => load().catch(e => toast(errorText(e))))
const blur = (e: Event) => (e.target as HTMLElement).innerText.trim()
</script>

<template>
  <template v-if="data">
    <Pivot :items="[{ id: 'p', label: data.product.name }, { id: 'k', label: 'what it knows' }]" current="p" />
    <p class="mt-3.5 mb-[26px] max-w-[80ch] text-[17px] text-ink-2">
      <template v-if="data.product.readAt">Learned from {{ data.product.url }} on {{ new Date(data.product.readAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) }}, {{ data.product.memory.pages ?? 0 }} pages. </template>
      Anyone on the team can correct it, and every post after uses the correction.
    </p>

    <section v-if="running || data.product.status === 'failed'" class="mb-10 grid max-w-[760px] gap-5">
      <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] font-light text-cyan">{{ running ? 'reading the site' : 'reading failed' }}</h2>
      <JobLines :lines="lines" :running="running" />
      <p v-if="!running && data.job?.error" class="m-0 bg-magenta px-3.5 py-2.5 font-normal text-black">{{ data.job.error }}</p>
    </section>

    <div class="grid items-start gap-10 lg:grid-cols-2">
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">platforms</h2>
        <p class="m-0 text-ink-2">Every post gets Facebook, X and LinkedIn copy, and Reddit when the angle suits a community.</p>
        <label class="flex items-center gap-3 text-[17px]">
          <input type="checkbox" class="size-[18px] flex-none accent-cyan" :checked="!!data.product.memory.instagram" @change="e => save({ instagram: (e.target as HTMLInputElement).checked }, (e.target as HTMLInputElement).checked ? 'Instagram on. New posts get a caption.' : 'Instagram off. New posts skip it.')">
          also write Instagram captions
        </label>
      </section>
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">tile colour</h2>
        <div class="flex gap-2">
          <button v-for="f in FILLS" :key="f" class="size-12 aria-pressed:outline-2 aria-pressed:outline-offset-4 aria-pressed:outline-ink" :aria-pressed="data.product.colour === f" :aria-label="f" :style="{ background: fill(f) }" @click="save({ colour: f }, 'Colour changed.')" />
        </div>
      </section>
    </div>

    <section class="mt-10 grid gap-4">
      <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">screens</h2>
      <div class="flex flex-wrap items-center gap-3.5">
        <label class="btn btn-sm cursor-pointer" :class="{ 'pointer-events-none opacity-45': uploading > 0 }" for="shot-upload">{{ uploading ? `adding ${uploading}…` : 'add your own screenshots' }}</label>
        <input id="shot-upload" ref="picker" type="file" accept="image/png,image/jpeg,image/webp" multiple class="sr-only" @change="upload">
        <p class="m-0 max-w-[62ch] text-ink-2">For moments a link can’t reach: a dashboard behind sign-in, a result mid-action. Name each one by what it shows; the writer reads the name.</p>
      </div>
      <p v-if="!data.shots.length" class="m-0 text-ink-2">None yet.</p>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
        <div v-for="s in data.shots" :key="s.id" class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2">
          <div class="relative">
            <img :src="s.url" :alt="s.label" class="aspect-[16/10] w-full bg-raise object-contain" loading="lazy">
            <span v-if="s.source !== 'read'" class="absolute top-0 left-0 bg-cyan px-1.5 py-0.5 text-[12px] font-normal text-black">{{ s.source === 'upload' ? 'added by the team' : 'from your local app' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <input :id="`shot-${s.id}`" v-model="s.use" type="checkbox" class="size-[18px] flex-none accent-cyan" :aria-label="`Use ${s.label} in posts`" @change="setUse(s.id, s.use)">
            <input :value="s.label" class="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent py-0.5 text-[15px] text-ink outline-0 hover:border-rule focus:border-cyan" :aria-label="`Name of screen ${s.label}`" @change="rename(s.id, ($event.target as HTMLInputElement).value)">
            <button class="flex-none text-[13px] text-ink-3 hover:text-magenta" :aria-label="`Remove ${s.label}`" @click="removeShot(s.id)">remove</button>
          </div>
        </div>
      </div>
    </section>

    <LocalRepo :product-id="data.product.id" :shipped="data.shipped" :clips="data.clips" @changed="load" />

    <div class="mt-10 grid items-start gap-10 lg:grid-cols-2">
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">voice rules</h2>
        <ul class="m-0 grid list-none gap-2.5 p-0 text-[17px]">
          <li v-for="(r, k) in rules" :key="k" class="flex items-baseline gap-3">
            {{ r.text }}<em class="ml-auto text-[14px] whitespace-nowrap text-ink-3 not-italic">{{ r.source === 'team' ? `added by ${r.by === me?.email ? 'you' : r.by}` : 'learned' }}</em>
            <button class="text-[14px] text-ink-3 hover:text-magenta" :aria-label="`Remove rule: ${r.text}`" @click="removeRule(k)">remove</button>
          </li>
        </ul>
        <form class="flex items-center gap-2.5" @submit.prevent="addRule">
          <label for="newrule" class="sr-only">New rule</label>
          <input id="newrule" v-model="newRule" class="input min-w-0 flex-1 !text-[17px]" placeholder="say ‘work’, never ‘ticket’">
          <button class="btn btn-sm">add rule</button>
        </form>
      </section>
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">what it does</h2>
        <p class="-mx-3 px-3 py-2.5 text-[21px] leading-[1.4] outline-0 hover:bg-raise focus:shadow-[inset_0_0_0_2px_var(--color-cyan)]" contenteditable="true" @blur="e => blur(e) !== (data!.product.memory.what ?? '') && save({ what: blur(e) })">{{ data.product.memory.what || 'Not read yet.' }}</p>
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">who it is for</h2>
        <p class="-mx-3 px-3 py-2.5 text-[21px] leading-[1.4] outline-0 hover:bg-raise focus:shadow-[inset_0_0_0_2px_var(--color-cyan)]" contenteditable="true" @blur="e => blur(e) !== (data!.product.memory.who ?? '') && save({ who: blur(e) })">{{ data.product.memory.who || 'Not read yet.' }}</p>
      </section>
    </div>

    <div class="mt-10 grid items-start gap-10 lg:grid-cols-2">
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">brand</h2>
        <div class="flex flex-wrap items-center gap-1.5">
          <i v-for="c in data.product.memory.brand?.colours ?? []" :key="c" class="size-12" :style="{ background: c }" :title="c" />
          <span class="ml-2 text-[13px] text-ink-3">{{ (data.product.memory.brand?.fonts ?? []).join(', ') || 'no fonts read yet' }}, taken from the site</span>
        </div>
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">angles already used</h2>
        <p class="m-0 max-w-[70ch] text-ink-2">{{ (data.product.memory.anglesUsed ?? []).slice(-12).map(a => a.title).join(' · ') || 'None yet. It won’t repeat an angle it has used recently.' }}</p>
      </section>
      <section class="grid content-start gap-4">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">demo login</h2>
        <p class="m-0 text-ink-2">{{ data.product.hasLogin ? 'A demo login is saved. It is never shown again.' : 'None yet. With one it can show screens behind sign-in.' }} <span v-if="data.product.need" class="text-orange">{{ data.product.need }}.</span></p>
        <form class="grid gap-2.5 md:grid-cols-[1fr_1fr_auto]" @submit.prevent="saveLogin">
          <input v-model="user" class="input !text-[17px]" autocomplete="off" placeholder="demo@yourapp.com" aria-label="Demo login">
          <input v-model="pass" class="input !text-[17px]" type="password" autocomplete="new-password" placeholder="demo password" aria-label="Demo password">
          <button class="btn btn-sm" :disabled="!user || !pass">save</button>
        </form>
        <div class="mt-4 flex flex-wrap gap-2.5">
          <button class="btn btn-ghost btn-sm" :disabled="running" @click="reread">read the site again</button>
          <button v-if="!confirmDelete" class="btn btn-ghost btn-sm" @click="confirmDelete = true">delete product</button>
          <span v-else class="flex flex-wrap items-center gap-2.5"><span class="text-ink-2">Delete {{ data.product.name }} and all its posts? This can’t be undone.</span>
            <button class="btn btn-sm !border-magenta !bg-magenta" @click="remove">yes, delete</button><button class="btn btn-ghost btn-sm" @click="confirmDelete = false">keep it</button></span>
        </div>
      </section>
    </div>
  </template>
</template>
