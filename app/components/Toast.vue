<script setup lang="ts">
const msg = useToast()
</script>

<template>
  <div v-if="msg" role="status" class="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-1/2 z-30 max-w-[calc(100%-32px)] -translate-x-1/2 bg-cyan px-[18px] py-3 text-[16px] font-normal text-black md:bottom-[calc(24px+env(safe-area-inset-bottom,0px))]">{{ msg }}</div>
</template>
