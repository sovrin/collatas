<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { AppSummary } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { embedSnippet } from '../../lib/embed'

/** collatas' part of a project's page: its feedback form, or a way to start one. */
const props = defineProps<{ project: ProjectSummary }>()
const { data, error, refresh } = await useProjectFetch<{ app: AppSummary | null }>(
  '/feedback/form',
  { key: `collatas-project-${props.project.id}` },
)
const app = computed(() => data.value?.app)
const origin = useRequestURL().origin

async function start() {
  await $fetch(`/api/p/${props.project.id}/feedback/form/create`, { method: 'POST', body: {} })
  await refresh()
}
</script>

<template>
  <!-- Under the module's name and icon, which the project page puts above it. -->
  <div class="stack gap-3">
    <AppAlert v-if="error" title="Could not load its feedback form.">{{
      errorMessage(error)
    }}</AppAlert>
    <template v-else-if="app">
      <!-- Setup only: what needs the owner (new feedback, a full form) is in the project's status. -->
      <EmbedCode :code="embedSnippet(app, origin)" />
      <p><NuxtLink :to="`/p/${project.id}/feedback/_form`" class="link">Form settings</NuxtLink></p>
    </template>
    <PanelStart
      v-else-if="data"
      label="Collect feedback"
      failed="Could not start collecting feedback."
      :start="start"
    >
      Not collecting feedback yet. Start, and you get a form to embed in its pages.
    </PanelStart>
  </div>
</template>
