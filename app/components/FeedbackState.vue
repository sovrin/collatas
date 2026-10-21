<script setup lang="ts">
import type { Status } from '../../shared/contracts'
import { feedbackStates } from '../lib/feedback'
// The state as a marker and a word; the word takes the tone's ink only when it needs the owner.
const props = defineProps<{ status: Status }>()
const state = computed(() => feedbackStates[props.status])
</script>
<template>
  <StateDot :tone="state.tone" class="text-s">
    <span :class="state.needsOwner ? `text-${state.tone}` : 'text-muted'">{{ state.label }}</span>
  </StateDot>
</template>
