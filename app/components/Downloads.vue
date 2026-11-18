<script setup lang="ts">
import type { Platform, Post, Product } from '#shared/types'

// Downloads for the post's visual, sized for the platform in view. Made in the browser from the same visual as the preview.
const props = defineProps<{ post: Post; product: Product; platform: Platform; brand: Brand }>()
const stage = ref<HTMLElement>()
const staged = ref<{ size: Size; slide: number } | null>(null)
const busy = ref<string | null>(null)
const v = computed(() => props.post.visual)
const slug = computed(() => `${props.product.name}-${props.post.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60))

// The size each platform wants for a single image or clip.
const main = computed<Size>(() => props.platform === 'X' || props.platform === 'Reddit' ? SIZES.wide : SIZES.portrait)

async function shoot(size: Size, slide = 0) {
  staged.value = { size, slide }
  await nextTick()
  const el = stage.value?.firstElementChild?.firstElementChild as HTMLElement
  return capture(el, size)
}

async function run(key: string, fn: () => Promise<void>) {
  busy.value = key
  try {
    await fn()
  } catch (e) {
    toast(e instanceof Error ? e.message : 'The download did not work. Try again.')
  } finally {
    busy.value = null
    staged.value = null
  }
}

const image = (size: Size) => run(`png-${size.label}`, async () => save(await canvasBlob(await shoot(size)), `${slug.value}-${size.w}x${size.h}.png`))

const copyImage = () => run('copy', async () => {
  const blob = canvasBlob(await shoot(main.value))
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  toast('Image copied. Paste it into the post.')
})

const slides = (size: Size, as: 'pdf' | 'zip') => run(as, async () => {
  if (v.value.format !== 'carousel') return
  const canvases: HTMLCanvasElement[] = []
  for (let i = 0; i < v.value.slides.length; i++) canvases.push(await shoot(size, i))
  if (as === 'pdf') save(await pdf(canvases), `${slug.value}.pdf`)
  else save(await zip(await Promise.all(canvases.map(async (c, i) => ({ name: `${slug.value}-${String(i + 1).padStart(2, '0')}.png`, blob: await canvasBlob(c) })))), `${slug.value}-slides.zip`)
})

const progress = ref(0)
const clip = (size: Size) => run(`mp4-${size.label}`, async () => {
  if (v.value.format !== 'clip') return
  progress.value = 0
  if (v.value.video) {
    save(await mp4FromVideo(`/api/clips/${v.value.video}/video`, v.value.frames, size, props.brand, p => (progress.value = p)), `${slug.value}-${size.w}x${size.h}.mp4`)
    return
  }
  const frames: HTMLCanvasElement[] = []
  for (let i = 0; i < v.value.frames.length; i++) frames.push(await shoot(size, i))
  save(await mp4(frames, size, p => (progress.value = p)), `${slug.value}-${size.w}x${size.h}.mp4`)
})
</script>

<template>
  <div class="flex flex-wrap gap-2.5">
    <template v-if="v.format === 'carousel'">
      <button v-if="platform === 'LinkedIn'" class="btn btn-ghost" :disabled="!!busy" @click="slides(SIZES.portrait, 'pdf')">{{ busy === 'pdf' ? 'making pdf…' : 'download pdf' }} <Icon name="play" /></button>
      <button class="btn btn-ghost" :disabled="!!busy" @click="slides(platform === 'X' ? SIZES.square : SIZES.portrait, 'zip')">{{ busy === 'zip' ? 'making slides…' : `download ${v.slides.length} slides` }} <Icon name="play" /></button>
    </template>
    <template v-else-if="v.format === 'clip'">
      <button class="btn btn-ghost" :disabled="!!busy" @click="clip(main)">{{ busy === `mp4-${main.label}` ? `making video… ${Math.round(progress * 100)}%` : `download mp4 ${main.label}` }} <Icon name="play" /></button>
      <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="clip(SIZES.story)">{{ busy === `mp4-${SIZES.story.label}` ? `story… ${Math.round(progress * 100)}%` : 'story mp4' }}</button>
    </template>
    <template v-else>
      <button class="btn btn-ghost" :disabled="!!busy" @click="copyImage">{{ busy === 'copy' ? 'copying…' : 'copy image' }} <Icon name="play" /></button>
      <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="image(main)">png {{ main.label }}</button>
      <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="image(SIZES.story)">story png</button>
    </template>
  </div>
  <div v-if="staged" ref="stage" class="pv-export" aria-hidden="true" :style="{ width: `${staged.size.w}px` }">
    <PostVisual :post="post" :product-id="product.id" :name="product.name" :brand="brand" mode="still" :slide="staged.slide" :aspect="aspectOf(staged.size)" />
  </div>
</template>
