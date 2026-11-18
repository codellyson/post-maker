<script setup lang="ts">
const fill = fillVar
const go = navigateTo
const route = useRoute()
const products = useProducts()
const current = useCurrent()
const me = useMe()
const bare = computed(() => route.path === '/signin' || route.path.startsWith('/render'))
const nav = [
  { to: '/', label: 'today', icon: 'today' },
  { to: '/products', label: 'products', icon: 'products' },
  { to: '/posted', label: 'posted', icon: 'posted' },
  { to: '/add', label: 'add product', icon: 'add' },
  { to: '/team', label: 'team', icon: 'team' },
] as const
const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
watch(() => me.value, (m) => { if (m) loadProducts().catch(() => {}) }, { immediate: true })
function pick(id: string) {
  current.value = id
  if (route.path !== '/') navigateTo('/')
}
</script>

<template>
  <slot v-if="bare" />
  <div v-else class="grid min-h-screen grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
    <nav aria-label="Main" class="sticky top-0 z-10 flex items-center gap-3.5 overflow-x-auto border-b-[1.5px] border-rule bg-ground px-4 py-2.5 md:h-screen md:flex-col md:items-stretch md:gap-[26px] md:overflow-visible md:border-b-0 md:py-[26px] md:pr-5 md:pl-7">
      <NuxtLink to="/" class="flex items-center gap-2.5 whitespace-nowrap text-[22px] leading-none no-underline md:text-[30px]">
        post maker <i class="inline-block size-[18px]" style="background: radial-gradient(circle, #fff 1.2px, transparent 1.6px) 0 0/6px 6px" aria-hidden="true" />
      </NuxtLink>
      <div class="flex gap-1.5 md:grid md:gap-2">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :aria-current="active(n.to) ? 'page' : undefined"
          class="group flex items-center gap-4 text-[17px] text-ink-2 no-underline hover:text-ink aria-[current=page]:text-cyan">
          <span class="grid size-[42px] place-items-center border-[1.5px] border-[#4a4a4a] group-hover:border-ink group-aria-[current=page]:border-cyan group-aria-[current=page]:bg-cyan group-aria-[current=page]:text-black md:size-[52px]"><Icon :name="n.icon" /></span>
          <span class="sr-only md:not-sr-only">{{ n.label }}</span>
        </NuxtLink>
      </div>
      <div v-if="products.length" class="hidden gap-2 border-t-[1.5px] border-rule pt-4 md:grid">
        <h2 class="mb-1 text-[17px] text-cyan">my products</h2>
        <button v-for="p in products" :key="p.id" class="flex items-center gap-2.5 py-0.5 text-left text-[15px] aria-pressed:font-semibold" :aria-pressed="current === p.id" @click="pick(p.id)">
          <i class="size-2.5 flex-none" :style="{ background: fill(p.colour) }" />{{ p.name }}<span class="ml-auto text-cyan tabular-nums">{{ p.ready }}</span>
        </button>
      </div>
      <p v-if="me" class="mt-auto hidden truncate text-[13px] text-ink-3 md:block">{{ me.email }}</p>
    </nav>
    <main class="min-w-0 overflow-x-clip px-4 pt-[18px] pb-20 md:pr-8 md:pl-0">
      <slot />
    </main>
  </div>
</template>
