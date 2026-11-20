<script setup lang="ts">
const route = useRoute()
const email = ref(String(route.query.email ?? ''))
const code = ref('')
const step = ref<'email' | 'code'>('email')
const busy = ref(false)
const error = ref('')
const invite = computed(() => (route.query.invite ? String(route.query.invite) : undefined))

async function send() {
  busy.value = true
  error.value = ''
  try {
    const r = await $fetch<{ devCode?: string }>('/api/auth/request', { method: 'POST', body: { email: email.value } })
    if (r.devCode) code.value = r.devCode
    step.value = 'code'
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
async function verify() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { email: email.value, code: code.value, invite: invite.value } })
    await loadMe()
    await navigateTo(String(route.query.next ?? '/'))
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-20 md:px-14">
    <Pivot :items="[{ id: 's', label: 'post maker' }, { id: 't', label: 'sign in' }]" current="s" />
    <p class="mt-3 mb-9 max-w-[52ch] text-[19px] text-ink-2">{{ invite ? 'You were invited to a team. Sign in with the address the invite went to.' : 'Today’s best posts for your products, ready to copy. We email you a six-digit code; no password.' }}</p>
    <form v-if="step === 'email'" class="grid max-w-[560px] gap-[18px]" @submit.prevent="send">
      <label class="field" for="email">your email<input id="email" v-model="email" class="input" type="email" autocomplete="email" required placeholder="you@company.com"></label>
      <button class="btn justify-self-start" :disabled="busy" :aria-busy="busy">email me a code <Icon name="play" /></button>
    </form>
    <form v-else class="grid max-w-[560px] gap-[18px]" @submit.prevent="verify">
      <label class="field" for="code">the code we sent to {{ email }}<input id="code" v-model="code" class="input tracking-[.2em]" inputmode="numeric" autocomplete="one-time-code" required placeholder="000000"></label>
      <div class="flex flex-wrap gap-2.5">
        <button class="btn" :disabled="busy" :aria-busy="busy">sign in <Icon name="play" /></button>
        <button type="button" class="btn btn-ghost" @click="step = 'email'">use another email</button>
      </div>
    </form>
    <p v-if="error" class="mt-5 max-w-[560px] bg-magenta px-3.5 py-2.5 font-normal text-black" role="alert">{{ error }}</p>
  </div>
</template>
