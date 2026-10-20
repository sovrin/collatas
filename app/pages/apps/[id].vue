<script setup lang="ts">
import type { AppConfig } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { embedSnippet } from '../../lib/embed'

const route = useRoute()
const id = route.params.id as string
const { data: app, error, refresh } = await useFetch<AppConfig>(`/api/apps/${id}`)
useHead({ title: `Feedback form · ${id} · ${useRuntimeConfig().public.nexitas.name}` })

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
    await $fetch(`/api/apps/${id}/delete`, { method: 'POST', body: {} })
    await navigateTo(`/projects/${app.value?.projectId ?? ''}`)
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <div>
    <div class="cluster justify-between gap-4 mb-5">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><NuxtLink to="/">Projects</NuxtLink></li>
          <li v-if="app">
            <NuxtLink :to="`/projects/${app.projectId}`" class="font-mono">{{
              app.projectId
            }}</NuxtLink>
          </li>
          <li aria-current="page">Feedback form</li>
        </ol>
      </nav>
      <NuxtLink :to="`/feedback?app=${id}`" class="link text-s">Inbox</NuxtLink>
    </div>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this app.</strong> {{ errorMessage(error) }}</div>
    </div>
    <div v-else-if="app" class="stack gap-6">
      <h1 class="text-l weight-600">{{ app.name }}</h1>

      <div v-if="savedNotice" class="alert" data-tone="success" role="status">
        <div><strong>Saved.</strong> The form uses the new settings from its next load.</div>
      </div>
      <AppForm :key="JSON.stringify(app)" :app="app" @saved="saved" />

      <section class="stack gap-3" aria-labelledby="embed-title">
        <h2 id="embed-title" class="text-s weight-600">Embed</h2>
        <EmbedCode :code="embed" />
        <small class="text-muted text-s"
          >The form takes its look from the site's aequitas styles and opens wherever you place it,
          for example in a dialog.</small
        >
      </section>

      <section class="stack gap-3 hairline-t pt-5" aria-labelledby="delete-title">
        <h2 id="delete-title" class="text-s weight-600">Delete</h2>
        <p class="text-s text-muted">
          Stops collecting feedback for this project and removes all of it. Embedded forms stop
          working; the project stays.
        </p>
        <p>
          <button type="button" class="link text-danger" @click="deleteOpen = true">
            Delete the form and its feedback
          </button>
        </p>
        <div v-if="deleteError" class="alert" data-tone="danger" role="alert">
          <div><strong>Could not delete the app.</strong> {{ deleteError }}</div>
        </div>
      </section>
    </div>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Delete ${id} and its feedback?`"
      confirm-label="Delete form"
      tone="danger"
      :disabled="typed !== id"
      @confirm="remove"
    >
      <template #description>This cannot be undone.</template>
      <div class="field">
        <label for="confirm-id"
          >Type <span class="font-mono">{{ id }}</span> to confirm</label
        >
        <input id="confirm-id" v-model="typed" class="input font-mono text-s" autocomplete="off" />
      </div>
    </ConfirmDialog>
  </div>
</template>
