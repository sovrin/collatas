<script setup lang="ts">
import type { AppSummary } from '../../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { embedSnippet } from '../../../../lib/embed'

const project = useProject().id.value
const api = `/api/p/${project}/feedback/form`
const { data, error, refresh } = await useFetch<{ app: AppSummary | null }>(api)
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
useHead({ title: `Feedback form · ${project} · ${useRuntimeConfig().public.nexitas.name}` })

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

const origin = useRequestURL().origin
const embed = computed(() => (app.value ? embedSnippet(app.value, origin) : ''))

const deleteOpen = ref(false)
const typed = ref('')
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
  <div class="stack gap-5">
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li><NuxtLink to="/">Projects</NuxtLink></li>
        <li>
          <NuxtLink :to="`/p/${project}`" class="font-mono">{{ project }}</NuxtLink>
        </li>
        <li aria-current="page">Feedback form</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this app.</strong> {{ errorMessage(error) }}</div>
    </div>
    <template v-else-if="app">
      <div class="page-header">
        <div class="stack gap-1 min-w-0">
          <h1 class="text-xl weight-600">{{ app.name }}</h1>
        </div>
        <div class="cluster gap-2">
          <NuxtLink :to="`/p/${project}/feedback`" class="btn" data-size="s">Inbox</NuxtLink>
          <button
            type="button"
            class="btn"
            data-size="s"
            data-variant="ghost"
            data-tone="danger"
            @click="deleteOpen = true"
          >
            Delete form
          </button>
        </div>
      </div>
      <div v-if="deleteError" class="alert" data-tone="danger" role="alert">
        <div><strong>Could not delete the app.</strong> {{ deleteError }}</div>
      </div>

      <!-- What the form offers takes the room; the code that embeds it sits beside it. -->
      <div class="with-aside">
        <section class="stack gap-3 min-w-0" aria-labelledby="settings-title">
          <h2 id="settings-title" class="text-s weight-600 hairline-b pb-2">Settings</h2>
          <div v-if="savedNotice" class="alert" data-tone="success" role="status">
            <div><strong>Saved.</strong> The form uses the new settings from its next load.</div>
          </div>
          <AppForm :key="JSON.stringify(app)" :app="app" @saved="saved" />
        </section>

        <aside class="stack gap-3" aria-labelledby="embed-title">
          <h2 id="embed-title" class="text-s weight-600 hairline-b pb-2">Embed</h2>
          <EmbedCode :code="embed" />
          <small class="text-muted text-s"
            >The form takes its look from the site's aequitas styles and opens wherever you place
            it, for example in a dialog.</small
          >
        </aside>
      </div>
    </template>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Delete ${id} and its feedback?`"
      confirm-label="Delete form"
      tone="danger"
      :disabled="typed !== id"
      @confirm="remove"
    >
      <template #description
        >Stops collecting feedback for this project and removes all of it. Embedded forms stop
        working; the project stays. This cannot be undone.</template
      >
      <div class="field">
        <label for="confirm-id"
          >Type <span class="font-mono">{{ id }}</span> to confirm</label
        >
        <input id="confirm-id" v-model="typed" class="input font-mono text-s" autocomplete="off" />
      </div>
    </ConfirmDialog>
  </div>
</template>
