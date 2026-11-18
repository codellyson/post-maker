<script setup lang="ts">
const fill = fillVar
const go = navigateTo
const products = useProducts()
const current = useCurrent()
onMounted(() => loadProducts().catch(e => toast(errorText(e))))
const readyTotal = computed(() => products.value.reduce((n, p) => n + p.ready, 0))
function open(id: string) {
  current.value = id
  navigateTo('/')
}
</script>

<template>
  <Pivot :items="[{ id: 'p', label: 'products' }, { id: 'q', label: 'posted' }]" current="p" @pick="$event === 'q' && go('/posted')" />
  <p class="mt-3.5 mb-[26px] flex flex-wrap gap-x-[22px] text-[19px] text-ink-2"><b class="font-normal text-ink">{{ products.length }} products</b><span>{{ readyTotal }} posts ready today</span></p>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
    <div v-for="(p, i) in products" :key="p.id" class="rise relative flex aspect-[1.3] flex-col justify-between overflow-hidden text-black" :style="{ background: fill(p.colour), '--i': i }">
      <button class="absolute inset-0" :aria-label="`Today for ${p.name}`" @click="open(p.id)" />
      <div class="pointer-events-none p-[18px_20px_0]"><h3 class="m-0 text-[40px] leading-none font-light tracking-[-.03em]">{{ p.name }}</h3></div>
      <span v-if="p.need || p.status !== 'ready'" class="pointer-events-none mx-5 self-start bg-black px-2 py-1 text-[13px] text-ink">{{ p.status === 'reading' || p.status === 'new' ? 'reading the site' : p.status === 'failed' ? 'reading failed' : p.need }}</span>
      <div class="relative flex items-center justify-between gap-2 p-[0_20px_18px] text-[15px] font-normal">
        <span class="pointer-events-none">{{ p.ready }} ready · {{ p.postedThisWeek }} posted this week</span>
        <NuxtLink :to="`/products/${p.id}`" class="relative z-[1] underline underline-offset-4">what it knows</NuxtLink>
      </div>
    </div>
    <NuxtLink to="/add" class="flex aspect-[1.3] flex-col justify-between border-[1.5px] border-ink p-[18px_20px] text-ink no-underline hover:border-cyan hover:text-cyan">
      <h3 class="m-0 text-[40px] leading-none font-light tracking-[-.03em]">add a product</h3>
      <span class="flex items-center justify-between text-[15px] font-normal">paste its link <Icon name="play" /></span>
    </NuxtLink>
  </div>
</template>
