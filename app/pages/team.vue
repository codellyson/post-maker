<script setup lang="ts">
const me = useMe()
const email = ref('')
const busy = ref(false)
const devLink = ref('')
async function invite() {
  busy.value = true
  try {
    const r = await $fetch<{ devLink?: string }>('/api/invites', { method: 'POST', body: { email: email.value } })
    devLink.value = r.devLink ?? ''
    toast(`Invite sent to ${email.value}.`)
    email.value = ''
  } catch (e) {
    toast(errorText(e))
  } finally {
    busy.value = false
  }
}
async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  me.value = null
  navigateTo('/signin')
}
</script>

<template>
  <Pivot :items="[{ id: 't', label: 'team' }]" current="t" />
  <p class="mt-3.5 mb-[26px] text-[19px] text-ink-2">{{ me?.workspace?.name }}. Everyone here sees the same products, posts and posting log.</p>
  <div class="grid items-start gap-10 lg:grid-cols-2">
    <section class="grid content-start gap-4">
      <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">people</h2>
      <ul class="m-0 grid list-none gap-2.5 p-0 text-[19px]">
        <li v-for="m in me?.members ?? []" :key="m.email" class="flex items-baseline gap-3">{{ m.email }}<em class="ml-auto text-[14px] text-ink-3 not-italic">{{ m.email === me?.email ? 'you · ' : '' }}{{ m.role }}</em></li>
      </ul>
    </section>
    <section class="grid content-start gap-4">
      <h2 class="m-0 border-b-[1.5px] border-cyan pb-3 text-[30px] leading-none font-light text-cyan">invite someone</h2>
      <form class="grid gap-3" @submit.prevent="invite">
        <label class="field" for="invite-email">their email<input id="invite-email" v-model="email" class="input" type="email" required placeholder="ada@company.com"></label>
        <button class="btn justify-self-start" :disabled="busy">send invite <Icon name="play" /></button>
      </form>
      <p v-if="devLink" class="m-0 text-[13px] break-all text-ink-3">Local dev, no email sent. Invite link: {{ devLink }}</p>
      <button class="btn btn-ghost btn-sm mt-6 justify-self-start" @click="signOut">sign out</button>
    </section>
  </div>
</template>
