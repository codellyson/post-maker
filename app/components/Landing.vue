<script setup lang="ts">
// The public front page: the offer, the link field that starts sign-up, then one real visit told as tiles in time order.
// The posts are real ones Post maker wrote for Fillie, one of the owner's own products.
const url = ref('')
const MAC_APP = 'https://github.com/codellyson/post-maker/releases/latest/download/Post-maker-mac.zip'

function start() {
  const raw = url.value.trim()
  if (!raw) return
  const link = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  navigateTo({ path: '/signin', query: { next: `/add?url=${encodeURIComponent(link)}` } })
}

useHead({
  title: 'Post maker · today’s best posts for your app, ready to copy',
  meta: [{ name: 'description', content: 'Paste your app’s link. Post maker learns it, writes daily posts from your real screens, and a strict editor keeps only the best. You post by hand.' }],
})

// How it works, end to end. Every line is something the app does today.
const steps = [
  { fill: 'bg-cyan', title: 'it learns your app', text: 'Paste your link. It opens your app like a new user, cuts out the screens worth showing, and learns what it does, who it’s for and how it talks.' },
  { fill: 'bg-magenta', title: 'it writes every morning', text: 'At 6am, seven ideas: carousels, clips and close-ups from your real screens, with copy for each feed. It never repeats a recent angle.' },
  { fill: 'bg-lime', title: 'an editor cuts most', text: 'Every draft is scored. Only three to five pass, best first. The rest show you why they were dropped.', tests: true },
  { fill: 'bg-orange', title: 'you post it', text: 'Copy, press post yourself, mark it posted. Your team sees who posted what, where.' },
]
const tests = ['stops the scroll', 'one idea', 'specific to your app', 'about the reader', 'the visual earns it', 'a reason to click', 'shows, not tells']

const visit = [
  { at: '09:00', step: 'open', fill: '', title: '3 ready today', note: 'fillie · best first' },
  { at: '09:00', step: 'the best one first', fill: 'bg-magenta', title: 'box six at 22:52', note: 'clip · 0:13', big: true },
  { at: '09:01', step: 'copy', fill: 'bg-cyan', title: '“22:52. The portal closes at midnight.”', note: 'facebook text copied' },
  { at: '09:02', step: 'you post it', fill: 'bg-orange', title: 'you press post, on facebook', note: 'by you, by hand' },
  { at: '09:03', step: 'done', fill: 'bg-lime', title: 'posted', note: 'the team can see it' },
]
</script>

<template>
  <div class="min-h-dvh overflow-x-clip px-4 pb-16 md:px-14">
    <header class="flex items-center justify-between pt-5 md:pt-7">
      <span class="flex items-center gap-2.5 text-[22px] leading-none md:text-[26px]">post maker <i class="inline-block size-[16px]" style="background: radial-gradient(circle, #fff 1.2px, transparent 1.6px) 0 0/6px 6px" aria-hidden="true" /></span>
      <nav class="flex items-center gap-5 text-[16px] text-ink-2 md:text-[18px]" aria-label="Site">
        <a :href="MAC_APP" class="text-ink-2 no-underline hover:text-cyan">mac app</a>
        <NuxtLink to="/signin" class="text-ink no-underline hover:text-cyan">sign in</NuxtLink>
      </nav>
    </header>

    <h1 class="pivot -mx-0.5 mt-2" aria-label="Post maker"><span class="pivot-track"><span>post maker</span> <span class="text-[#5e5e5e]" aria-hidden="true">today</span></span></h1>

    <section class="mt-4 grid items-end gap-6 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10" aria-labelledby="offer">
      <div>
        <p id="offer" class="m-0 text-[52px] leading-[.95] font-extralight tracking-[-.04em] md:text-[84px]">you ship.<br><span class="text-[#5e5e5e]">nobody hears.</span></p>
        <p class="mt-5 mb-0 max-w-[46ch] text-[19px] leading-[1.4] text-ink-2">Paste your app’s link. Post maker writes today’s best few posts from your real screens, ready to copy.</p>
      </div>
      <div>
        <form class="flex flex-col gap-2.5 sm:flex-row" @submit.prevent="start">
          <label for="app-link" class="sr-only">Your app’s link</label>
          <input id="app-link" v-model="url" class="input min-w-0 flex-1 placeholder:!text-ink-3 sm:max-w-[440px]" type="text" inputmode="url" autocomplete="url" placeholder="https://yourapp.com" required>
          <button class="btn justify-self-start whitespace-nowrap">write my posts <Icon name="play" /></button>
        </form>
        <p class="mt-3 mb-0 text-[14px] text-ink-3">We email you a code to sign in. No password, no card.</p>
      </div>
    </section>

    <section class="mt-16 md:mt-24" aria-labelledby="visit">
      <h2 id="visit" class="mb-5 text-[34px] leading-none font-extralight tracking-[-.03em] md:text-[52px]">five minutes. <span class="text-[#5e5e5e]">open to posted.</span></h2>
      <ol class="m-0 grid list-none gap-2.5 p-0 lg:grid-cols-[1fr_1.6fr_1fr_1fr_1fr]">
        <li v-for="(v, i) in visit" :key="i" class="rise grid gap-2 max-lg:grid-cols-[64px_minmax(0,1fr)] max-lg:items-stretch" :style="{ '--i': i }">
          <span class="text-[14px] text-ink-3 tabular-nums lg:h-5"><b class="font-normal text-ink-2">{{ v.at }}</b><span class="max-lg:block lg:ml-1.5">{{ v.step }}</span></span>
          <div class="flex flex-col justify-between gap-6 p-[18px_20px] lg:aspect-[4/5]" :class="[v.fill || 'border-[1.5px] border-ink', v.fill ? 'text-black' : 'text-ink', v.big ? 'lg:aspect-auto' : '']">
            <span class="leading-[1.02] tracking-[-.02em] text-balance" :class="v.big ? 'text-[44px] font-light tracking-[-.03em] md:text-[58px]' : 'text-[24px]'">{{ v.title }}</span>
            <small class="text-[14px] font-normal" :class="v.fill ? '' : 'text-ink-2'">{{ v.note }}</small>
          </div>
        </li>
      </ol>
      <p class="mt-4 text-[14px] text-ink-3">A real post Post maker wrote for Fillie, one of our own products.</p>
    </section>

    <section class="mt-16 md:mt-24" aria-labelledby="how">
      <h2 id="how" class="mb-5 text-[34px] leading-none font-extralight tracking-[-.03em] text-balance md:text-[52px]">learns once. <span class="text-[#5e5e5e]">writes every morning.</span></h2>
      <ol class="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(s, i) in steps" :key="s.title" class="rise flex flex-col justify-between gap-6 p-[18px_20px] text-black lg:aspect-[4/5]" :class="s.fill" :style="{ '--i': i }">
          <span class="text-[64px] leading-[.8] font-extralight tracking-[-.04em] tabular-nums" aria-hidden="true">{{ i + 1 }}</span>
          <div class="grid gap-2.5">
            <h3 class="m-0 text-[30px] leading-[1] font-light tracking-[-.03em]">{{ s.title }}</h3>
            <p class="m-0 text-[15px] leading-[1.4] font-normal">{{ s.text }}</p>
            <p v-if="s.tests" class="m-0 text-[13px] leading-[1.45] font-normal opacity-80">scored on: {{ tests.join(' · ') }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="mt-16 md:mt-24" aria-label="The quality bar">
      <p class="m-0 -mx-0.5 text-[64px] leading-[.95] font-extralight tracking-[-.045em] md:text-[clamp(84px,11.5vw,184px)] md:whitespace-nowrap">it writes. <span class="text-lime max-md:block">you post.</span></p>
      <p class="mt-3 mb-8 text-[19px] text-ink-2">The bar: you post it with at most a small edit.</p>
      <ul class="m-0 grid list-none gap-x-10 gap-y-5 p-0 text-[22px] leading-[1.25] md:grid-cols-2 md:text-[26px]">
        <li>never posts for you. <span class="text-ink-3">No platform logins, no scheduling.</span></li>
        <li>nothing made up. <span class="text-ink-3">No invented customers or numbers; example details are flagged.</span></li>
        <li>real screens, not stock. <span class="text-ink-3">In your brand, in your voice, with your rules.</span></li>
        <li>you see the cuts. <span class="text-ink-3">Dropped ideas come with their reasons.</span></li>
      </ul>
    </section>

    <footer class="mt-14 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t-[1.5px] border-rule pt-5 text-[16px] text-ink-2">
      <span>facebook · x · linkedin · instagram if you want it</span>
      <span>carousels, clips and close-ups from your real screens</span>
      <a :href="MAC_APP" class="ml-auto inline-flex items-center gap-2.5 whitespace-nowrap text-ink no-underline hover:text-cyan">mac app for your local repo <Icon name="play" /></a>
    </footer>
  </div>
</template>
