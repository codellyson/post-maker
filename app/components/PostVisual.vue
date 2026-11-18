<script setup lang="ts">
import type { Post } from '#shared/types'

// Renders a post's visual in the customer's brand. `mode` picks the layout the platform shows:
// carousel as swipeable slides (LinkedIn, Instagram) or a 2x2 grid (X); `tall` for 4:5 feeds.
const props = defineProps<{ post: Post; productId: string; name: string; brand: Brand; mode?: 'swipe' | 'grid' | 'still'; tall?: boolean; slide?: number; paused?: boolean; aspect?: string }>()
const emit = defineEmits<{ slide: [n: number] }>()
const vars = computed(() => ({ '--pv-ground': props.brand.ground, '--pv-ink': props.brand.ink, '--pv-accent': props.brand.accent, '--pv-font': `'${props.brand.font}'` }))
const v = computed(() => props.post.visual)
const bg = (shot?: string): Record<string, string> => (shot ? { backgroundImage: `url(${shotUrl(props.productId, shot)})` } : {})
const accent = accentHtml
const i = computed(() => props.slide ?? 0)
const count = computed(() => (v.value.format === 'carousel' ? v.value.slides.length : 0))
// A recorded clip plays the real video; its caption follows the video's clock.
const video = ref<HTMLVideoElement>()
const now = ref(0)
const caption = computed(() => {
  if (v.value.format !== 'clip') return ''
  const t = props.mode === 'still' ? Infinity : now.value
  return [...v.value.frames].reverse().find(f => (f.at ?? 0) <= t)?.cap ?? v.value.frames[0]?.cap ?? ''
})
watch(() => props.paused, p => (p ? video.value?.pause() : video.value?.play().catch(() => {})))
useHead(() => ({ link: props.brand.fontUrl ? [{ rel: 'stylesheet', href: props.brand.fontUrl, key: `font-${props.brand.font}`, crossorigin: 'anonymous' }] : [] }))
</script>

<template>
  <div :style="vars">
    <!-- Carousel -->
    <template v-if="v.format === 'carousel'">
      <div v-if="mode === 'grid'" class="pv-grid">
        <template v-for="(s, k) in v.slides.slice(0, 4)" :key="k">
          <PostSlide :s="s" :bg="bg" :name="name" />
        </template>
      </div>
      <div v-else class="pv pv-carousel" :style="aspect ? { aspectRatio: aspect } : undefined">
        <div class="track" :style="{ transform: `translateX(-${i * 100}%)` }">
          <PostSlide v-for="(s, k) in v.slides" :key="k" :s="s" :bg="bg" :name="name" />
        </div>
        <template v-if="mode !== 'still'">
          <button v-if="i > 0" class="absolute top-1/2 left-2.5 grid size-[34px] -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#111] shadow-[0_2px_8px_rgba(0,0,0,.3)]" aria-label="Previous slide" @click="emit('slide', i - 1)"><Icon name="prev" /></button>
          <button v-if="i < count - 1" class="absolute top-1/2 right-2.5 grid size-[34px] -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#111] shadow-[0_2px_8px_rgba(0,0,0,.3)]" aria-label="Next slide" @click="emit('slide', i + 1)"><Icon name="play" /></button>
          <span class="absolute top-2.5 right-2.5 rounded-full bg-black/65 px-2 py-0.5 font-sans text-xs text-white">{{ i + 1 }} / {{ count }}</span>
        </template>
      </div>
    </template>

    <!-- Recorded clip: the real screen recording, captions timed to it -->
    <div v-else-if="v.format === 'clip' && v.video" class="pv pv-rec" :class="{ tall }" :style="aspect ? { aspectRatio: aspect } : undefined">
      <video ref="video" :src="`/api/clips/${v.video}/video`" muted playsinline loop preload="metadata" :autoplay="mode !== 'still' && !paused" @timeupdate="now = ($event.target as HTMLVideoElement).currentTime" />
      <div class="cap-bar"><p class="cap">{{ caption }}</p></div>
      <slot name="clip-ui" />
    </div>

    <!-- Clip: frames cross-fade on a loop, captions burned in -->
    <div v-else-if="v.format === 'clip'" class="pv pv-clip" :class="{ tall, paused }" :style="{ '--n': v.frames.length, ...(aspect ? { aspectRatio: aspect } : {}) }">
      <div v-for="(f, j) in v.frames" :key="j" class="pv-frame" :class="{ still: mode === 'still' && j === (slide ?? 0) }" :style="{ '--j': j }">
        <span v-if="f.time" class="time">{{ f.time }}</span>
        <p class="cap">{{ f.cap }}</p>
        <pre v-if="f.code" class="code">{{ f.code }}</pre>
        <div v-else-if="f.shot" class="shot" :style="bg(f.shot)" />
      </div>
      <slot name="clip-ui" />
    </div>

    <!-- Close-up image -->
    <div v-else class="pv pv-image" :class="{ tall }" :style="aspect ? { aspectRatio: aspect } : undefined">
      <p class="hl" v-html="accent(v.hl)" />
      <span class="logo"><b>{{ name.charAt(0).toUpperCase() }}</b>{{ name }}</span>
      <div class="shot" :style="bg(v.shot)" />
    </div>
  </div>
</template>
