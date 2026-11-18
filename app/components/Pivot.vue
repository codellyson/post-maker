<script setup lang="ts">
// The giant lowercase header. The current item sits at the left; the next ones peek in from the right edge.
const props = defineProps<{ items: { id: string; label: string }[]; current: string | null }>()
const emit = defineEmits<{ pick: [id: string] }>()
const track = ref<HTMLElement>()
const shift = ref(0)
function measure() {
  const el = track.value?.querySelector<HTMLElement>('[aria-current="true"]')
  shift.value = el?.offsetLeft ?? 0
}
watch(() => [props.current, props.items.length], () => nextTick(measure))
onMounted(() => { measure(); addEventListener('resize', measure) })
onBeforeUnmount(() => removeEventListener('resize', measure))
</script>

<template>
  <div class="pivot">
    <div ref="track" class="pivot-track" :style="{ transform: `translateX(-${shift}px)` }">
      <button v-for="it in items" :key="it.id" :aria-current="it.id === current" :tabindex="items.length > 1 ? 0 : -1"
        class="border-0 bg-transparent p-0 text-[#5e5e5e] hover:text-[#8a8a8a] aria-[current=true]:text-ink" @click="emit('pick', it.id)">{{ it.label }}</button>
    </div>
  </div>
</template>
