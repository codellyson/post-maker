<script setup lang="ts">
const url = ref('')
const user = ref('')
const pass = ref('')
const busy = ref(false)
const lines = ref<string[]>([])
const state = ref<'form' | 'reading' | 'done' | 'failed'>('form')
const error = ref('')
const productId = ref<string | null>(null)
const jobId = ref<string | null>(null)
const stopping = ref(false)
const host = computed(() => { try { return new URL(url.value).host } catch { return url.value } })

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const r = await $fetch<{ id: string; jobId: string }>('/api/products', { method: 'POST', body: { url: url.value, user: user.value || undefined, pass: pass.value || undefined } })
    productId.value = r.id
    pass.value = ''
    state.value = 'reading'
    jobId.value = r.jobId
    await loadProducts()
    useCurrent().value = r.id
    const job = await followJob(r.jobId, l => (lines.value = l))
    state.value = job.status === 'done' ? 'done' : 'failed'
    if (job.error) error.value = job.error
    await loadProducts()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Pivot :items="[{ id: 'a', label: 'add a product' }]" current="a" />
  <p class="mt-3.5 mb-[26px] max-w-[70ch] text-[19px] text-ink-2">Paste the live app’s link. It opens it like a new user would, learns what it does and cuts out the screens worth showing. A few minutes.</p>
  <form v-if="state === 'form'" class="grid max-w-[760px] gap-[18px]" @submit.prevent="submit">
    <label class="field" for="url">link to the app<input id="url" v-model="url" class="input" inputmode="url" autocomplete="off" required placeholder="https://yourapp.com"></label>
    <div class="grid gap-3.5 md:grid-cols-2">
      <label class="field" for="demo-user">demo login <small>optional</small><input id="demo-user" v-model="user" class="input" autocomplete="off" placeholder="demo@yourapp.com"></label>
      <label class="field" for="demo-pass">demo password <small>optional</small><input id="demo-pass" v-model="pass" class="input" type="password" autocomplete="new-password" placeholder="demo account only"></label>
    </div>
    <p class="m-0 max-w-[62ch] text-ink-2">With a demo login it can show the real product: dashboards and screens behind sign-in. Use a demo account with example data, never a real one. It is stored encrypted and never shown again.</p>
    <button class="btn justify-self-start" :disabled="busy" :aria-busy="busy">read the product <Icon name="play" /></button>
    <p v-if="error" class="m-0 bg-magenta px-3.5 py-2.5 font-normal text-black" role="alert">{{ error }}</p>
  </form>
  <section v-else class="grid max-w-[760px] gap-5">
    <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] font-light text-cyan">reading {{ host }}</h2>
    <JobLines :lines="lines" :running="state === 'reading'" />
    <button v-if="state === 'reading' && jobId" class="btn btn-ghost btn-sm justify-self-start" :disabled="stopping" :aria-busy="stopping" @click="stopping = true; stopRunning(jobId)">{{ stopping ? 'stopping after this step…' : 'stop reading' }}</button>
    <p v-if="state === 'failed'" class="m-0 bg-magenta px-3.5 py-2.5 font-normal text-black" role="alert">{{ error || 'Reading the site did not work.' }}</p>
    <div v-if="state !== 'reading'" class="flex flex-wrap gap-2.5">
      <NuxtLink v-if="productId" :to="`/products/${productId}`" class="btn">see what it learned <Icon name="play" /></NuxtLink>
      <NuxtLink v-if="state === 'done'" to="/" class="btn btn-ghost">today’s posts <Icon name="play" /></NuxtLink>
    </div>
  </section>
</template>
