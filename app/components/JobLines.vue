<script setup lang="ts">
// Live progress of a background job, one line per step. The last line pulses while it runs.
defineProps<{ lines: string[]; running: boolean }>()
</script>

<template>
  <ol class="m-0 grid list-none gap-3 p-0 text-[20px]">
    <li v-for="(l, k) in lines" :key="k" class="flex items-center gap-3.5" :class="running && k === lines.length - 1 ? 'text-cyan' : 'text-ink'">
      <span class="size-3.5 flex-none border-2" :class="running && k === lines.length - 1 ? 'animate-pulse border-cyan bg-cyan' : 'border-lime bg-lime'" aria-hidden="true" />{{ l }}
    </li>
  </ol>
</template>
