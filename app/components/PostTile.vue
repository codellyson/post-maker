<script setup lang="ts">
import type { Post } from '#shared/types'

// A live tile: flat product colour, the post's title, and a flip to its first line every few seconds.
const props = defineProps<{ post: Post; wide: boolean; selected: boolean; fill: string; productId: string; i: number }>()
const FORMAT = { carousel: 'carousel', clip: 'clip', image: 'close-up image' } as const
const detail = computed(() => {
  const v = props.post.visual
  return v.format === 'carousel' ? `carousel · ${v.slides.length} slides` : v.format === 'clip' ? `clip · 0:${String(Math.round(v.frames.length * 2.5)).padStart(2, '0')}` : FORMAT.image
})
const art = computed(() => {
  const v = props.post.visual
  const id = v.format === 'image' ? v.shot : v.format === 'carousel' ? v.slides.find(s => 'shot' in s && s.shot)?.['shot' as never] : v.frames.find(f => f.shot)?.shot
  return id ? shotUrl(props.productId, id as string) : ''
})
const posted = computed(() => props.post.postings.length > 0)
</script>

<template>
  <button class="rise relative border-0 bg-transparent p-0 text-left [perspective:900px] active:scale-[.98]" :class="wide ? 'col-span-3 aspect-[1.75]' : 'aspect-square'"
    :aria-pressed="selected" :style="{ '--i': i }" :aria-label="`${post.title}, ${detail}`">
    <span class="tile-flip absolute inset-0" :style="{ '--d': `${1.5 + i * 2.2}s` }">
      <span class="tile-face" :class="[wide ? 'p-5' : 'p-3.5', posted && 'saturate-25 brightness-70']" :style="{ background: fill }">
        <h3 class="m-0 font-light text-balance" :class="wide ? 'max-w-[9ch] text-[clamp(40px,4.4vw,64px)] leading-[.98] tracking-[-.03em]' : 'max-w-[12ch] text-[clamp(17px,1.7vw,25px)] leading-[1.05] tracking-[-.02em]'">{{ post.title }}</h3>
        <span v-if="wide && art" class="absolute right-[-4%] bottom-[-12%] aspect-[16/10] w-[52%] bg-white bg-cover bg-top shadow-[-8px_-8px_24px_rgba(0,0,0,.22)]" :style="{ backgroundImage: `url(${art})` }" />
        <span class="relative z-[1] flex max-w-[50%] items-end gap-2 text-[13px] font-normal" :class="!wide && 'hidden md:flex md:max-w-full'">{{ detail }}<Icon v-if="wide" :name="post.format === 'carousel' ? 'slides' : post.format" /></span>
        <span v-if="wide" class="tile-dots" aria-hidden="true" />
      </span>
      <span class="tile-face tile-back" :class="wide ? 'p-5' : 'p-3.5'" :style="{ background: fill }">
        <p class="m-0 max-w-[24ch] font-light leading-[1.3]" :class="wide ? 'text-[clamp(18px,1.6vw,22px)]' : 'text-[14px]'">“{{ post.hook }}”</p>
        <small class="text-[12px] font-normal opacity-75">first line</small>
      </span>
    </span>
    <span v-if="posted" class="absolute top-1/2 left-5 z-[2] -translate-y-1/2 bg-black px-2.5 py-1 text-[13px] font-normal text-ink">posted on {{ post.postings.map(p => p.platform).join(', ') }}</span>
    <span v-if="selected" class="pointer-events-none absolute -inset-1.5 border-2 border-ink" />
  </button>
</template>

<style scoped>
.tile-flip { transform-style: preserve-3d; }
@media (prefers-reduced-motion: no-preference) {
  .tile-flip { animation: flip 9s cubic-bezier(.65, 0, .35, 1) infinite; animation-delay: var(--d, 0s); }
  button:active .tile-flip { animation-play-state: paused; }
}
.tile-face { position: absolute; inset: 0; backface-visibility: hidden; display: flex; flex-direction: column; justify-content: space-between; color: #000; overflow: hidden; }
.tile-back { transform: rotateX(180deg); }
.tile-dots { position: absolute; right: 16px; top: 16px; width: 64px; height: 40px; background: radial-gradient(circle, rgba(0, 0, 0, .28) 1.1px, transparent 1.5px) 0 0 / 7px 7px; }
</style>
