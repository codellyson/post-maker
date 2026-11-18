<script setup lang="ts">
import type { Slide } from '#shared/types'

const accent = accentHtml
defineProps<{ s: Slide; name: string; bg: (shot?: string) => Record<string, string> }>()
</script>

<template>
  <div v-if="s.kind === 'cover'" class="pv pv-slide pv-cover">
    <span class="logo"><b>{{ name.charAt(0).toUpperCase() }}</b>{{ name }}</span>
    <p class="hl" v-html="accent(s.hl)" />
    <p class="sub">{{ s.sub }}</p>
    <div v-if="s.shot" class="shot" :style="bg(s.shot)" />
  </div>
  <div v-else-if="s.kind === 'cta'" class="pv pv-slide pv-cta">
    <p class="hl" v-html="accent(s.hl)" />
    <span class="url">{{ s.url }}</span>
  </div>
  <div v-else-if="s.kind === 'text'" class="pv pv-slide pv-textslide">
    <span class="num">{{ s.n }}</span>
    <p class="cap">{{ s.cap }}</p>
    <span class="logo"><b>{{ name.charAt(0).toUpperCase() }}</b>{{ name }}</span>
  </div>
  <div v-else class="pv pv-slide pv-shotslide">
    <span class="num">{{ s.n }}</span>
    <p class="cap">{{ s.cap }}</p>
    <div class="shot" :style="bg(s.shot)" />
  </div>
</template>
