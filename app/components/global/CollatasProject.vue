<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { AppSummary } from '../../../shared/contracts'
import { errorMessage, formatCount } from '#nexitas/app/lib/format'
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
      <p class="cluster gap-3">
        <!-- A tone only where the owner is needed: unread feedback, and a form so full that it
             turns feedback away. -->
        <NuxtLink :to="`/p/${project.id}/feedback`" class="link">
          <StateDot v-if="app.newCount" tone="warning"
            >{{ formatCount(app.newCount) }} new</StateDot
          >
          <template v-else>Inbox</template>
        </NuxtLink>
        <StateDot v-if="app.full" tone="warning">full</StateDot>
        <span v-else-if="!app.enabled" class="text-muted">paused</span>
        <NuxtLink :to="`/p/${project.id}/feedback/form`" class="link">Form settings</NuxtLink>
      </p>
      <EmbedCode :code="embedSnippet(app, origin)" />
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
