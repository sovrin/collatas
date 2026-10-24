<script setup lang="ts">
import type { AppSummary } from '../../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { embedSnippet } from '../../../../lib/embed'

const project = useProject().id.value
const api = `/api/p/${project}/feedback/form`
// Not live: a refresh would reset the settings while the owner types (its counts change it).
const { data, error, refresh } = await useProjectFetch<{ app: AppSummary | null }>(
  '/feedback/form',
  { live: false },
)
// A project that collects no feedback has no form.
const app = computed(() => data.value?.app)
if (data.value && !app.value)
  throw createError({
    statusCode: 404,
    statusMessage: 'This project collects no feedback.',
    fatal: true,
  })
// Its id, which the embedded form names and the owner types to delete it, is the project's unless
// it predates projects.
const id = computed(() => app.value?.id ?? project)

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

const origin = useRequestURL().origin
const embed = computed(() => (app.value ? embedSnippet(app.value, origin) : ''))

const deleteError = ref('')
async function remove() {
  deleteError.value = ''
  try {
    await $fetch(`${api}/delete`, { method: 'POST', body: {} })
    await navigateTo(`/p/${project}`)
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <AppPage title="Feedback form" failed="Could not load the feedback form." :error="error">
    <!-- What the form offers takes the room; the code that embeds it sits beside it. -->
    <template v-if="app">
      <AppAlert v-if="deleteError" title="Could not delete the feedback form.">{{
        deleteError
      }}</AppAlert>
      <AppSection title="Settings">
        <AppAlert v-if="savedNotice" tone="success" title="Saved."
          >The form uses the new settings from its next load.</AppAlert
        >
        <AppForm :key="JSON.stringify(app)" :app="app" @saved="saved" />
      </AppSection>
    </template>

    <template v-if="app" #aside>
      <AppSection title="Embed">
        <EmbedCode :code="embed" />
        <small class="text-muted text-s"
          >The form takes its look from the site's aequitas styles and opens wherever you place it,
          for example in a dialog.</small
        >
      </AppSection>
    </template>

    <template v-if="app" #danger>
      <span>Stops collecting feedback and removes all of it; the project stays.</span>
      <DangerAction
        label="Delete form"
        :title="`Delete ${id} and its feedback?`"
        :confirm-word="id"
        @confirm="remove"
      >
        Stops collecting feedback for this project and removes all of it. Embedded forms stop
        working; the project stays. This cannot be undone.
      </DangerAction>
    </template>
  </AppPage>
</template>
