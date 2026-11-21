<script setup lang="ts">
const fill = fillVar
const go = navigateTo
const route = useRoute()
const products = useProducts()
const current = useCurrent()
const me = useMe()
const bare = computed(() => route.path === '/signin' || route.path.startsWith('/render') || (route.path === '/' && !me.value))
const nav = [
  { to: '/', label: 'today', icon: 'today' },
  { to: '/posts', label: 'all posts', icon: 'posts' },
  { to: '/products', label: 'products', icon: 'products' },
  { to: '/posted', label: 'posted', icon: 'posted' },
  { to: '/add', label: 'add product', icon: 'add' },
  { to: '/team', label: 'team', icon: 'team' },
] as const
const active = (to: string) => (to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`))
watch(() => me.value, (m) => { if (m) loadProducts().catch(() => {}) }, { immediate: true })
// While anything reads or writes in the background, refresh the list so every page shows it and its end.
let poll: ReturnType<typeof setTimeout> | undefined
watch(products, (list) => {
  clearTimeout(poll)
  if (list.some(p => p.job)) poll = setTimeout(() => loadProducts().catch(() => {}), 5000)
}, { deep: true })
onBeforeUnmount(() => clearTimeout(poll))
function pick(id: string) {
  current.value = id
  if (route.path !== '/' && route.path !== '/posts') navigateTo('/')
}
</script>

<template>
  <slot v-if="bare" />
  <div v-else class="grid min-h-screen grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
    <nav aria-label="Main" class="fixed inset-x-0 bottom-0 z-10 border-t-[1.5px] border-rule bg-ground px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-[26px] md:border-t-0 md:py-[26px] md:pr-5 md:pl-7">
      <NuxtLink to="/" class="hidden items-center gap-2.5 whitespace-nowrap text-[30px] leading-none no-underline md:flex">
        post maker <i class="inline-block size-[18px]" style="background: radial-gradient(circle, #fff 1.2px, transparent 1.6px) 0 0/6px 6px" aria-hidden="true" />
      </NuxtLink>
      <div class="grid grid-cols-5 md:gap-2 md:grid-cols-1">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :aria-current="active(n.to) ? 'page' : undefined"
          class="group flex flex-col items-center gap-1 text-[11px] text-ink-2 no-underline hover:text-ink aria-[current=page]:text-cyan md:flex-row md:gap-4 md:text-[17px]" :class="n.to === '/add' && 'max-md:hidden'">
          <span class="grid size-[42px] place-items-center border-[1.5px] border-[#4a4a4a] group-hover:border-ink group-aria-[current=page]:border-cyan group-aria-[current=page]:bg-cyan group-aria-[current=page]:text-black max-md:size-9 max-md:border-0 md:size-[52px]"><Icon :name="n.icon" /></span>
          <span>{{ n.label }}</span>
        </NuxtLink>
      </div>
      <div v-if="products.length" class="hidden gap-2 border-t-[1.5px] border-rule pt-4 md:grid">
        <h2 class="mb-1 text-[17px] text-cyan">my products</h2>
        <button v-for="p in products" :key="p.id" class="flex items-center gap-2.5 py-0.5 text-left text-[15px] aria-pressed:font-semibold" :aria-pressed="current === p.id" @click="pick(p.id)">
          <i class="size-2.5 flex-none" :style="{ background: fill(p.colour) }" />{{ p.name }}<span v-if="p.job" class="waiting ml-auto text-[13px] text-cyan">{{ p.job === 'write' ? 'writing' : 'reading' }}</span><span v-else class="ml-auto text-cyan tabular-nums">{{ p.ready }}</span>
        </button>
      </div>
      <div v-if="me" class="mt-auto hidden gap-1.5 md:grid">
        <p class="m-0 truncate text-[13px] text-ink-3">{{ me.email }}</p>
        <button class="justify-self-start text-[13px] text-ink-2 underline decoration-[#444] underline-offset-4 hover:text-cyan" @click="signOut">sign out</button>
      </div>
    </nav>
    <main class="min-w-0 overflow-x-clip px-4 pt-[18px] pb-28 md:pr-8 md:pb-20 md:pl-0">
      <slot />
    </main>
  </div>
</template>
