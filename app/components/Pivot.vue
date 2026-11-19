<script setup lang="ts">
// The giant lowercase header. The current item sits at the left; the others follow it in a loop and peek in from the right.
// The track holds the items twice, so a pick always slides forward; after the slide it snaps back into the first copy.
const props = defineProps<{ items: { id: string; label: string }[]; current: string | null }>()
const emit = defineEmits<{ pick: [id: string] }>()
const track = ref<HTMLElement>()
const pos = ref(0)
const shift = ref(0)
const still = ref(true)
const loop = computed(() => (props.items.length > 1 ? [...props.items, ...props.items] : props.items))
const offset = (k: number) => track.value?.children[k] instanceof HTMLElement ? (track.value.children[k] as HTMLElement).offsetLeft : 0

function place(animate: boolean) {
  const n = props.items.length
  const i = Math.max(0, props.items.findIndex(it => it.id === props.current))
  const next = !animate || i >= pos.value ? i : i + n
  still.value = !animate
  pos.value = next
  shift.value = offset(next)
}
function settle() {
  const n = props.items.length
  if (pos.value < n) return
  still.value = true
  pos.value -= n
  shift.value = offset(pos.value)
}
watch(() => props.current, () => nextTick(() => place(true)))
watch(() => props.items.length, () => nextTick(() => place(false)))
const remeasure = () => place(false)
onMounted(() => { place(false); addEventListener('resize', remeasure) })
onBeforeUnmount(() => removeEventListener('resize', remeasure))
</script>

<template>
  <div class="pivot">
    <div ref="track" class="pivot-track" :class="{ 'pivot-still': still }" :style="{ transform: `translateX(-${shift}px)` }" @transitionend="settle">
      <button v-for="(it, k) in loop" :key="k" :aria-current="k < items.length && it.id === current" :aria-hidden="k >= items.length || undefined"
        :tabindex="k >= items.length || items.length < 2 ? -1 : 0"
        class="border-0 bg-transparent p-0" :class="k === pos ? 'text-ink' : 'text-[#5e5e5e] hover:text-[#8a8a8a]'" @click="emit('pick', it.id)">{{ it.label }}</button>
    </div>
  </div>
</template>
