<script setup lang="ts">
// Line icons drawn for the rail and buttons: one stroke weight, square caps.
defineProps<{ name: 'today' | 'products' | 'posted' | 'add' | 'team' | 'play' | 'prev' | 'slides' | 'clip' | 'image' }>()
</script>

<template>
  <svg v-if="name === 'play' || name === 'prev'" viewBox="0 0 10 10" aria-hidden="true" class="size-3.5 fill-current"><path :d="name === 'play' ? 'M2 1l7 4-7 4z' : 'M8 1L1 5l7 4z'" /></svg>
  <svg v-else-if="name === 'slides' || name === 'clip' || name === 'image'" viewBox="0 0 20 20" aria-hidden="true" class="size-[18px] fill-current">
    <path v-if="name === 'slides'" d="M2 4h11v12H2zM15 5h1.5v10H15zM18 6h1v8h-1z" />
    <path v-else-if="name === 'clip'" d="M2 4h16v12H2zM8 7v6l5-3z" fill-rule="evenodd" />
    <path v-else d="M2 4h16v12H2zm2 10h12l-4-5-3 3.5-2-2z" fill-rule="evenodd" />
  </svg>
  <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="size-[22px] fill-none stroke-current" style="stroke-width:1.6;stroke-linecap:square">
    <path v-if="name === 'today'" d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" />
    <path v-else-if="name === 'products'" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    <path v-else-if="name === 'posted'" d="M4 12.5 9.5 18 20 6" />
    <path v-else-if="name === 'add'" d="M12 4v16M4 12h16" />
    <path v-else d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
  </svg>
</template>
