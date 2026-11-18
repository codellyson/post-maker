<script setup lang="ts">
const paused = defineModel<boolean>('paused', { default: false })
</script>

<template>
  <div class="absolute top-2.5 left-2.5 z-[3]"><button class="rounded-full bg-black/65 px-2.5 py-0.5 font-sans text-xs text-white" @click="paused = !paused">{{ paused ? 'Play' : 'Pause' }}</button></div>
  <div class="absolute top-2.5 right-2.5 z-[3] flex gap-1.5 font-sans text-xs text-white"><span class="rounded-full bg-black/65 px-2.5 py-0.5">Captions on</span></div>
</template>
