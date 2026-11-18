<script setup lang="ts">
import { FILLS } from '#shared/types'
const fill = fillVar
const go = navigateTo
const products = useProducts()
const current = useCurrent()
const product = computed(() => products.value.find(p => p.id === current.value))
const data = ref<TodayData | null>(null)
const selected = ref<string | null>(null)
const lines = ref<string[]>([])
const working = ref(false)

async function load() {
  if (!current.value) return
  data.value = await $fetch<TodayData>(`/api/products/${current.value}/today`)
  if (!data.value.posts.some(p => p.id === selected.value)) selected.value = data.value.posts[0]?.id ?? null
  // A write started elsewhere (or the morning cron) is still running: follow it.
  if (data.value.job && (data.value.job.status === 'queued' || data.value.job.status === 'running') && !working.value) follow(data.value.job.id)
}
async function follow(jobId: string) {
  working.value = true
  lines.value = []
  try {
    const job = await followJob(jobId, l => (lines.value = l))
    if (job.status === 'failed') toast(job.error ?? 'That did not work. Try again.')
    await Promise.all([load(), loadProducts()])
  } finally {
    working.value = false
  }
}
async function write() {
  try {
    const { jobId } = await $fetch<{ jobId: string }>(`/api/products/${current.value}/write`, { method: 'POST' })
    follow(jobId)
  } catch (e) {
    toast(errorText(e))
  }
}
watch(current, () => { data.value = null; load().catch(e => toast(errorText(e))) }, { immediate: true })
// The best tile wears the product's colour; the rest step through the other fills.
const tileFill = (i: number) => fill(FILLS[(FILLS.indexOf(product.value!.colour) + i) % FILLS.length]!)
const post = computed(() => data.value?.posts.find(p => p.id === selected.value))
const ready = computed(() => data.value?.posts.filter(p => !p.postings.length).length ?? 0)
const dateLabel = computed(() => data.value ? new Date(`${data.value.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <div v-if="!products.length" class="grid gap-6 pt-6">
    <Pivot :items="[{ id: 'hi', label: 'post maker' }]" current="hi" />
    <p class="max-w-[48ch] text-[21px] text-ink-2">Add your first product by pasting its link. Post maker reads it and writes today’s best posts for it.</p>
    <NuxtLink to="/add" class="btn justify-self-start">add a product <Icon name="play" /></NuxtLink>
  </div>
  <div v-else-if="product">
    <Pivot :items="products.map(p => ({ id: p.id, label: p.name }))" :current="current" @pick="current = $event" />
    <p class="mt-3.5 mb-[26px] flex flex-wrap items-baseline gap-x-[22px] gap-y-1 text-[19px] text-ink-2">
      <b class="font-normal text-ink">{{ ready }} ready today</b><span>best first</span><span>{{ dateLabel }}</span>
      <a v-if="data?.dropped.length" href="#dropped" class="text-[15px] text-ink-3 underline decoration-[#444] underline-offset-4">{{ data.dropped.length }} dropped by the quality check</a>
    </p>

    <div v-if="product.status === 'reading' || product.status === 'new'" class="grid max-w-[720px] gap-4">
      <p class="text-[21px]">Still reading {{ product.url }}. Today’s posts come right after.</p>
      <NuxtLink :to="`/products/${product.id}`" class="btn btn-ghost justify-self-start">watch it read <Icon name="play" /></NuxtLink>
    </div>
    <div v-else-if="product.status === 'failed'" class="grid max-w-[720px] gap-4">
      <p class="text-[21px]">Reading {{ product.url }} did not work.</p>
      <NuxtLink :to="`/products/${product.id}`" class="btn justify-self-start">see why and try again <Icon name="play" /></NuxtLink>
    </div>
    <template v-else-if="data">
      <div v-if="working" class="grid max-w-[720px] gap-5">
        <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] font-light text-cyan">writing today’s posts</h2>
        <JobLines :lines="lines" :running="true" />
      </div>
      <div v-else-if="!data.posts.length" class="grid max-w-[720px] gap-5">
        <p class="text-[21px] text-ink-2">Nothing written for today yet. It writes every morning at 06:00 UTC, or now if you ask.</p>
        <button class="btn justify-self-start" @click="write">write today’s posts <Icon name="play" /></button>
      </div>
      <div v-else class="grid grid-cols-1 items-start gap-9 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
        <div class="grid min-w-0 grid-cols-1">
          <div class="grid grid-cols-3 gap-2.5" role="group" aria-label="Today's posts">
            <PostTile v-for="(p, i) in data.posts" :key="p.id" :post="p" :i="i" :wide="i === 0" :selected="p.id === selected" :fill="tileFill(i)" :product-id="product.id" @click="selected = p.id" />
          </div>
          <button v-if="data.posts.filter(p => p.status === 'approved' || p.postings.length).length < 5" class="btn btn-ghost btn-sm mt-3 justify-self-start" @click="write">more ideas <Icon name="play" /></button>
          <section v-if="data.dropped.length" id="dropped" class="mt-10 grid content-start gap-4">
            <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">dropped by the quality check</h2>
            <ul class="m-0 grid list-none gap-2.5 p-0">
              <li v-for="(d, k) in data.dropped" :key="k" class="grid gap-0.5"><s class="text-[19px] text-ink-3">{{ d.title }}</s><span>{{ d.reason }}</span></li>
            </ul>
          </section>
        </div>
        <OpenPost v-if="post" :post="post" :product="product" @changed="load" />
      </div>
    </template>
  </div>
</template>
