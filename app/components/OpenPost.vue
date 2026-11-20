<script setup lang="ts">
import { FOLD, LIMITS, PLATFORMS, type Platform, type Post, type Product } from '#shared/types'

const props = defineProps<{ post: Post; product: Product }>()
const emit = defineEmits<{ changed: [] }>()
const me = useMe()
const platforms = computed(() => PLATFORMS.filter(p => props.post.copy[p]))
const platform = ref<Platform>('Facebook')
const saved = ref<'' | 'saving' | 'saved'>('')
watch(() => props.post.id, () => { platform.value = platforms.value[0]!; saved.value = '' }, { immediate: true })
const brand = computed(() => brandOf(props.product.memory))
const text = computed(() => props.post.copy[platform.value] ?? '')
const fold = computed(() => FOLD[platform.value])
const asking = ref(false)
const busy = ref<string | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | undefined
function edit(t: string) {
  const where = platform.value
  props.post.copy[where] = t
  clearTimeout(saveTimer)
  saved.value = 'saving'
  saveTimer = setTimeout(() => $fetch(`/api/posts/${props.post.id}`, { method: 'PATCH', body: { platform: where, text: t } })
    .then(() => (saved.value = 'saved'))
    .catch((e) => { saved.value = ''; toast(`Not saved: ${errorText(e)}`) }), 600)
}
async function act(path: string, method: 'POST' | 'DELETE', bodyData?: object, msg?: string) {
  busy.value = [method, path, (bodyData as { platform?: string } | undefined)?.platform].filter(Boolean).join(' ')
  try {
    await $fetch(`/api/posts/${props.post.id}/${path}`, { method: method as 'POST', body: bodyData })
    if (msg) toast(msg)
    asking.value = false
    emit('changed')
  } catch (e) {
    toast(errorText(e))
  } finally {
    busy.value = null
  }
}
const copy = copyText
// Where the team posts by hand. X takes the text in the link; the others get it on the clipboard to paste.
const composer = computed(() => ({
  Facebook: 'https://www.facebook.com/',
  X: `https://x.com/intent/post?text=${encodeURIComponent(text.value)}`,
  LinkedIn: 'https://www.linkedin.com/feed/?shareActive=true',
  Instagram: 'https://www.instagram.com/',
  Reddit: 'https://www.reddit.com/submit',
})[platform.value])
function openPlatform() {
  if (platform.value !== 'X') copy(text.value)
}
</script>

<template>
  <section class="rise grid min-w-0 content-start gap-[18px]" aria-live="polite">
    <h2 class="m-0 text-[clamp(30px,2.8vw,42px)] leading-[1.05] font-light tracking-[-.02em] text-balance">{{ post.title }}</h2>
    <p class="-mt-2 max-w-[62ch] text-ink-2"><b class="font-normal text-ink">{{ post.pattern }}.</b> {{ post.why }}</p>
    <p v-if="post.flag" class="m-0 bg-orange px-3.5 py-2.5 font-normal text-black">{{ post.flag }}</p>
    <div class="flex flex-wrap gap-[22px] text-[22px]" role="tablist" aria-label="Platform">
      <button v-for="p in platforms" :key="p" role="tab" :aria-selected="p === platform" class="font-light text-[#5a5a5a] hover:text-ink-2 aria-selected:text-ink" @click="platform = p">{{ p.toLowerCase() }}</button>
    </div>
    <div class="flex flex-wrap gap-2.5">
      <button class="btn" @click="copy(text)">copy {{ platform.toLowerCase() }} text <Icon name="play" /></button>
      <a class="btn btn-ghost no-underline" :href="composer" target="_blank" rel="noopener" @click="openPlatform">open {{ platform.toLowerCase() }} <Icon name="play" /></a>
    </div>
    <p class="-mt-2.5 text-[13px] text-ink-3">{{ platform === 'X' ? 'Opens X with the text filled in. Add the image, then post.' : `Copies the text and opens ${platform}. Paste it, add the image, then post.` }}</p>
    <Downloads :post="post" :product="product" :platform="platform" :brand="brand" />
    <div class="flex flex-wrap items-center gap-3.5 text-[15px] text-ink-2">
      <template v-if="post.postings.length">
        <span class="pill bg-lime">Posted</span><span>by <b class="font-normal text-ink">{{ post.postings.at(-1)!.by === me?.email ? 'you' : post.postings.at(-1)!.by }}</b> on <b class="font-normal text-ink">{{ post.postings.map(p => p.platform).join(', ') }}</b></span>
      </template>
      <template v-else-if="post.status === 'approved'">
        <span class="pill bg-lime">Approved</span><span>by <b class="font-normal text-ink">{{ post.approvedBy === me?.email ? 'you' : post.approvedBy }}</b> · anyone can post it</span>
      </template>
      <template v-else><span class="pill bg-orange">Draft</span><span>needs one person to approve it</span></template>
    </div>
    <div class="flex flex-wrap gap-2.5">
      <button v-if="post.status !== 'approved'" class="btn btn-ghost btn-sm" :disabled="!!busy" :aria-busy="busy === 'POST approve'" @click="act('approve', 'POST', undefined, 'Approved. Anyone on the team can post it now.')">approve</button>
      <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="asking = !asking">mark posted</button>
      <button v-if="post.status === 'approved' && !post.postings.length" class="btn btn-ghost btn-sm" :disabled="!!busy" :aria-busy="busy === 'DELETE approve'" @click="act('approve', 'DELETE', undefined, 'Back to waiting for review.')">undo approve</button>
      <button v-if="post.postings.length" class="btn btn-ghost btn-sm" :disabled="!!busy" :aria-busy="busy === 'DELETE posted'" @click="act('posted', 'DELETE')">undo posted</button>
    </div>
    <div v-if="asking" class="grid max-w-[420px] gap-2.5 border-[1.5px] border-ink p-3.5">
      <span>Where did you post it?</span>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in platforms" :key="p" class="btn btn-sm" :class="p !== platform && 'btn-ghost'" :disabled="!!busy" :aria-busy="busy === `POST posted ${p}`" @click="act('posted', 'POST', { platform: p }, 'Marked posted. The team can see it.')">{{ p.toLowerCase() }}</button>
      </div>
    </div>
    <span class="text-[13px] text-ink-3 tabular-nums" :class="text.length > LIMITS[platform] && 'text-magenta'">{{ text.length }} / {{ LIMITS[platform].toLocaleString() }} characters<template v-if="fold"> · first {{ fold }} show before “more”</template><template v-if="saved"> · {{ saved === 'saving' ? 'saving…' : 'saved' }}</template></span>
    <Feed :post="post" :platform="platform" :product-id="product.id" :name="product.name" :url="product.url" :brand="brand" @edit="edit" />
    <p class="-mt-2.5 text-[13px] text-ink-3">Click the post text to edit it. Open “see more” first on LinkedIn, Facebook and Instagram.</p>
  </section>
</template>
