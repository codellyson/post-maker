<script setup lang="ts">
import type { Post } from '#shared/types'
const fill = fillVar
const products = useProducts()
const current = useCurrent()
const product = computed(() => products.value.find(p => p.id === current.value))
const posts = ref<Post[] | null>(null)
const selected = ref<string | null>(null)
const show = ref<'all' | 'waiting' | 'approved' | 'posted' | 'replaced'>('all')

async function load() {
  if (!current.value) return
  posts.value = await $fetch<Post[]>(`/api/products/${current.value}/posts`)
  if (!posts.value.some(p => p.id === selected.value)) selected.value = posts.value[0]?.id ?? null
}
const loadError = ref('')
function reload() { loadError.value = ''; posts.value = null; load().catch(e => (loadError.value = errorText(e))) }
watch(current, reload, { immediate: true })
// A background write just finished: show its posts.
watch(() => product.value?.job, (now, was) => { if (was === 'write' && !now) load().catch(() => {}) })

const stateOf = (p: Post) => (p.postings.length ? 'posted' : p.status === 'approved' ? 'approved' : p.replaced ? 'replaced' : 'waiting')
const shown = computed(() => (posts.value ?? []).filter(p => show.value === 'all' || stateOf(p) === show.value))
const days = computed(() => {
  const out: { day: string; posts: Post[] }[] = []
  for (const p of shown.value) {
    const last = out.at(-1)
    if (last?.day === p.day) last.posts.push(p)
    else out.push({ day: p.day, posts: [p] })
  }
  return out
})
const count = (s: typeof show.value) => (posts.value ?? []).filter(p => s === 'all' || stateOf(p) === s).length
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const post = computed(() => posts.value?.find(p => p.id === selected.value))
// When the post panel sits under the list (narrow screens), opening a post brings the panel into view.
const panel = ref<HTMLElement>()
function pick(id: string) {
  selected.value = id
  if (!matchMedia('(min-width: 64rem)').matches) nextTick(() => panel.value?.scrollIntoView({ behavior: 'smooth' }))
}
const stateText = (p: Post) => p.postings.length ? `posted on ${[...new Set(p.postings.map(g => g.platform))].join(', ')}` : p.status === 'approved' ? 'approved, not posted' : p.replaced ? 'replaced by newer ideas' : 'waiting for review'
</script>

<template>
  <div v-if="!products.length" class="grid gap-6 pt-6">
    <Pivot :items="[{ id: 'all', label: 'all posts' }]" current="all" />
    <p class="max-w-[48ch] text-[21px] text-ink-2">No products yet. Add one and its posts collect here, day by day.</p>
    <NuxtLink to="/add" class="btn justify-self-start">add a product <Icon name="play" /></NuxtLink>
  </div>
  <div v-else-if="product">
    <Pivot :items="products.map(p => ({ id: p.id, label: p.name }))" :current="current" @pick="current = $event" />
    <div class="mt-3.5 mb-[26px] flex flex-wrap items-baseline gap-x-[22px] gap-y-2 text-[19px]" role="group" aria-label="Show">
      <button v-for="s in (['all', 'waiting', 'approved', 'posted', 'replaced'] as const)" :key="s" class="text-ink-2 hover:text-ink aria-pressed:text-ink" :aria-pressed="show === s" @click="show = s">
        {{ s === 'waiting' ? 'waiting for review' : s }} <span class="text-[15px] text-ink-3 tabular-nums">{{ count(s) }}</span>
      </button>
      <span class="text-[15px] text-ink-3">last 90 days</span>
    </div>

    <p v-if="product.job === 'write'" class="waiting mb-6 text-[17px] text-cyan">writing today’s posts… they appear here when done.</p>
    <p v-if="posts && !shown.length" class="text-[19px] text-ink-2">{{ posts.length ? 'Nothing here with this filter.' : 'No posts yet. Today writes the first ones.' }}</p>
    <div v-else-if="posts" class="grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <div class="grid min-w-0 gap-8">
        <section v-for="d in days" :key="d.day" class="grid gap-1">
          <h2 class="m-0 border-b-[1.5px] border-rule pb-2 text-[17px] font-light text-cyan">{{ dayLabel(d.day) }}</h2>
          <button v-for="p in d.posts" :key="p.id" class="grid grid-cols-[12px_minmax(0,1fr)] items-baseline gap-x-3 border-b md:grid-cols-[12px_minmax(0,1fr)_auto] border-[#1a1a1a] py-3 text-left hover:bg-raise aria-pressed:bg-raise" :aria-pressed="p.id === selected" @click="pick(p.id)">
            <i class="size-3 self-center" :style="{ background: fill(product.colour) }" />
            <span class="min-w-0">
              <span class="block truncate text-[19px]">{{ p.title }}</span>
              <span class="block truncate text-[15px] text-ink-3">{{ p.hook }}</span>
            </span>
            <span class="col-start-2 text-[14px] md:col-start-auto md:text-right md:whitespace-nowrap" :class="p.postings.length ? 'text-lime' : p.status === 'approved' ? 'text-cyan' : 'text-ink-3'">{{ p.format }} · {{ stateText(p) }}</span>
          </button>
        </section>
      </div>
      <div ref="panel" class="scroll-mt-20 md:scroll-mt-4 lg:sticky lg:top-[18px]"><OpenPost v-if="post" :post="post" :product="product" @changed="load" /></div>
    </div>
    <div v-else-if="loadError" class="grid max-w-[720px] gap-4"><p class="m-0 text-[19px]">Posts did not load: {{ loadError }}</p><button class="btn btn-ghost justify-self-start" @click="reload">try again <Icon name="play" /></button></div>
    <p v-else class="waiting text-[19px]">loading posts…</p>
  </div>
</template>
