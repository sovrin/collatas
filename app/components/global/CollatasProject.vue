<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { AppSummary } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { embedSnippet } from '../../lib/embed'

/** collatas' part of a project's page: its feedback form, or a way to start one. */
const props = defineProps<{ project: ProjectSummary }>()
const api = `/api/p/${props.project.id}/feedback/form`
const { data, error, refresh } = await useFetch<{ app: AppSummary | null }>(api, {
  key: `collatas-project-${props.project.id}`,
})
useLive(refresh)
const app = computed(() => data.value?.app)
const origin = useRequestURL().origin

const pending = ref(false)
const startError = ref('')
async function start() {
  pending.value = true
  startError.value = ''
  try {
    await $fetch(`${api}/create`, { method: 'POST', body: {} })
    await refresh()
  } catch (cause) {
    startError.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <!-- Under the module's name and icon, which the project page puts above it. -->
  <div class="stack gap-3">
    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load its feedback form.</strong> {{ errorMessage(error) }}</div>
    </div>
    <template v-else-if="app">
      <p class="cluster gap-3 text-s">
        <!-- Colour only where the owner is needed: unread feedback, and a form so full that it
             turns feedback away. -->
        <NuxtLink
          :to="`/p/${project.id}/feedback`"
          class="link"
          :class="app.newCount ? 'text-warning' : undefined"
          >{{ app.newCount ? `${app.newCount} new` : 'Inbox' }}</NuxtLink
        >
        <span v-if="app.full" class="text-warning">full</span>
        <span v-else-if="!app.enabled" class="text-muted">paused</span>
        <NuxtLink :to="`/p/${project.id}/feedback/form`" class="link">Form settings</NuxtLink>
      </p>
      <EmbedCode :code="embedSnippet(app, origin)" />
    </template>
    <template v-else-if="data">
      <p class="text-s text-muted">
        Not collecting feedback yet. Start, and you get a form to embed in its pages.
      </p>
      <p>
        <button
          type="button"
          class="btn"
          data-size="s"
          :disabled="pending"
          :aria-busy="pending || undefined"
          @click="start"
        >
          Collect feedback
        </button>
      </p>
      <div v-if="startError" class="alert" data-tone="danger" role="alert">
        <div><strong>Could not start collecting feedback.</strong> {{ startError }}</div>
      </div>
    </template>
  </div>
</template>
