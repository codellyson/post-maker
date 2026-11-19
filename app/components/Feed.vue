<script setup lang="ts">
import { FOLD, type Platform, type Post } from '#shared/types'

// The post as it looks in the feed. Always light, because that is how the feeds look.
// The text edits in place once it is fully open.
const props = defineProps<{ post: Post; platform: Platform; productId: string; name: string; url: string; brand: Brand }>()
const emit = defineEmits<{ edit: [text: string] }>()
const open = ref(false)
const slide = ref(0)
const paused = ref(false)
watch(() => [props.post.id, props.platform], () => { open.value = false; slide.value = 0 })
const text = computed(() => props.post.copy[props.platform] ?? '')
const fold = computed(() => FOLD[props.platform])
const cut = computed(() => !!fold.value && !open.value && text.value.length > fold.value)
const shown = computed(() => (cut.value ? text.value.slice(0, fold.value).replace(/\s+\S*$/, '') : text.value))
const handle = computed(() => props.name.replace(/[^a-z0-9]/gi, '').toLowerCase())
const host = computed(() => { try { return new URL(props.url).host } catch { return props.url } })
const mode = computed(() => (props.platform === 'X' && props.post.format === 'carousel' ? 'grid' : 'swipe'))
const tall = computed(() => props.platform !== 'X' && props.platform !== 'Reddit')
const editable = ref<HTMLElement>()
watch(editable, (el) => { if (el && el.innerText !== text.value) el.innerText = text.value })
watch(text, (t) => { if (editable.value && document.activeElement !== editable.value) editable.value.innerText = t })
</script>

<template>
  <div class="grid max-w-[560px] gap-2.5 bg-white p-3.5 text-[#0f1419]" style="font: 15px/1.4 -apple-system, 'Segoe UI', system-ui, sans-serif">
    <div class="flex items-center gap-2.5">
      <span class="grid size-10 flex-none place-items-center rounded-full font-bold text-white" :style="{ background: brand.accent, color: brand.ground }" aria-hidden="true">{{ name.charAt(0).toUpperCase() }}</span>
      <div class="min-w-0">
        <b>{{ platform === 'Instagram' ? host : name }}</b>
        <span v-if="platform === 'X'" class="text-[13px] text-[#536471]"> @{{ handle }} · now</span>
        <div v-if="platform === 'LinkedIn' || platform === 'Facebook'" class="text-[13px] text-[#536471]">{{ platform === 'Facebook' ? 'Just now' : 'Now' }} · Public</div>
        <div v-if="platform === 'Reddit'" class="text-[13px] text-[#536471]">r/SideProject · just now</div>
      </div>
    </div>
    <PostVisual v-if="platform === 'Instagram'" :post="post" :product-id="productId" :name="name" :brand="brand" :tall="tall" :slide="slide" :paused="paused" @slide="slide = $event">
      <template #clip-ui><ClipUi v-model:paused="paused" /></template>
    </PostVisual>
    <p v-if="cut" class="m-0 whitespace-pre-wrap text-[14.5px]">{{ shown }}<button class="text-[#536471]" @click="open = true">…{{ platform === 'LinkedIn' ? 'see more' : platform === 'Facebook' ? 'See more' : 'more' }}</button></p>
    <p v-else ref="editable" contenteditable="true" spellcheck="true" aria-label="Post text, editable"
      class="m-0 rounded-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-[14.5px] outline-0 hover:bg-[#f3f6f8] focus:bg-[#eef8fb] focus:shadow-[0_0_0_2px_var(--color-cyan)]"
      @input="emit('edit', ($event.target as HTMLElement).innerText)" />
    <PostVisual v-if="platform !== 'Instagram'" :post="post" :product-id="productId" :name="name" :brand="brand" :mode="mode" :tall="tall && (platform === 'LinkedIn' || platform === 'Facebook')" :slide="slide" :paused="paused" @slide="slide = $event">
      <template #clip-ui><ClipUi v-model:paused="paused" /></template>
    </PostVisual>
    <div class="flex gap-[18px] border-t border-[#e6e8ea] pt-2 text-[13px] text-[#536471]">
      <template v-if="platform === 'X'"><span>Reply</span><span>Repost</span><span>Like</span><span>Views</span></template>
      <template v-else-if="platform === 'Instagram'"><span>Like</span><span>Comment</span><span>Share</span><span class="ml-auto">Save</span></template>
      <template v-else-if="platform === 'Facebook'"><span>Like</span><span>Comment</span><span>Share</span></template>
      <template v-else-if="platform === 'Reddit'"><span>Upvote</span><span>Comment</span><span>Share</span></template>
      <template v-else><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></template>
    </div>
  </div>
</template>
