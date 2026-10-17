<script setup lang="ts">
import type { Status } from '#shared/contracts'
import { feedbackStates } from '~/lib/feedback'
// The state as a square marker and a word; the word takes the tone's ink only when it needs the owner.
const props = defineProps<{ status: Status }>()
const state = computed(() => feedbackStates[props.status])
</script>
<template>
  <span class="cluster gap-2 flex-nowrap text-s">
    <span class="dot" :data-tone="state.tone" aria-hidden="true"></span>
    <span :class="state.needsOwner ? `text-${state.tone}` : 'text-muted'">{{ state.label }}</span>
  </span>
</template>
