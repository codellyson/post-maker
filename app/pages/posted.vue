<script setup lang="ts">
const fill = fillVar
const go = navigateTo
type Row = { posted_at: number; platform: string; email: string; title: string; pattern: string; product: string; colour: string }
const rows = ref<Row[] | null>(null)
const me = useMe()
const loadError = ref('')
async function reload() { loadError.value = ''; try { rows.value = await $fetch<Row[]>('/api/posted') } catch (e) { loadError.value = errorText(e) } }
onMounted(reload)
const when = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const who = (e: string) => (e === me.value?.email ? 'you' : e.split('@')[0])
</script>

<template>
  <Pivot :items="[{ id: 'p', label: 'posted' }, { id: 'q', label: 'products' }]" current="p" @pick="$event === 'q' && go('/products')" />
  <p class="mt-3.5 mb-[26px] flex flex-wrap gap-x-[22px] text-[19px] text-ink-2"><b class="font-normal text-ink">{{ rows?.length ?? 0 }} {{ rows?.length === 1 ? 'post' : 'posts' }}</b><span>last 60 days</span><span>it won’t repeat an angle it has used recently</span></p>
  <div v-if="loadError" class="grid max-w-[720px] gap-4"><p class="m-0 text-[19px]">The posting log did not load: {{ loadError }}</p><button class="btn btn-ghost justify-self-start" @click="reload">try again <Icon name="play" /></button></div>
  <p v-else-if="!rows" class="waiting text-[19px]">loading the posting log…</p>
  <p v-else-if="!rows.length" class="text-[19px] text-ink-2">Nothing posted yet. Mark a post as posted on Today and it shows up here for the whole team.</p>
  <div v-else class="overflow-x-auto">
    <table class="w-full border-collapse text-[17px]">
      <thead class="max-md:sr-only"><tr class="text-left text-[15px] font-light text-cyan"><th class="border-b-[1.5px] border-rule pr-3 pb-2.5 font-light">when</th><th class="border-b-[1.5px] border-rule pr-3 pb-2.5 font-light">product</th><th class="border-b-[1.5px] border-rule pr-3 pb-2.5 font-light">post</th><th class="border-b-[1.5px] border-rule pr-3 pb-2.5 font-light">where</th><th class="border-b-[1.5px] border-rule pr-3 pb-2.5 font-light">who</th></tr></thead>
      <tbody>
        <tr v-for="(r, k) in rows" :key="k" class="border-b border-[#1a1a1a] max-md:grid max-md:grid-cols-[auto_1fr] max-md:gap-x-3 max-md:py-3">
          <td class="py-3.5 pr-3 whitespace-nowrap text-ink-3 tabular-nums max-md:col-span-2 max-md:py-0 max-md:text-[14px]">{{ when(r.posted_at) }}</td>
          <td class="py-3.5 pr-3 max-md:py-0"><span class="inline-flex items-center gap-2"><i class="size-3" :style="{ background: fill(r.colour) }" />{{ r.product }}</span></td>
          <td class="py-3.5 pr-3 max-md:col-span-2 max-md:py-0 max-md:text-[19px]">{{ r.title }}</td>
          <td class="py-3.5 pr-3 max-md:py-0"><span class="text-ink-3 md:hidden">on </span>{{ r.platform }}</td>
          <td class="py-3.5 pr-3 max-md:py-0"><span class="text-ink-3 md:hidden">by </span>{{ who(r.email) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
