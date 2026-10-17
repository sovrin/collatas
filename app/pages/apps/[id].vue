<script setup lang="ts">
import type { AppConfig } from '#shared/contracts'
import { errorMessage } from '~/lib/format'

const route = useRoute()
const id = route.params.id as string
const { data: app, error, refresh } = await useFetch<AppConfig>(`/api/apps/${id}`)
useHead({ title: `${id} · collatas` })

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

// What a site puts in its page to show this app's form.
const origin = useRequestURL().origin
// Split so this SFC's own <script> block is not closed by the string.
const SCRIPT_END = '</' + 'script>'
const embed = computed(() => {
  const fields = app.value?.context.map((field) => `${field.key}: '…'`).join(', ') ?? ''
  return [
    `<script type="module" src="${origin}/v1/form.js">${SCRIPT_END}`,
    `<collatas-form app="${id}"></collatas-form>`,
    ...(fields
      ? [`<script>document.querySelector('collatas-form').context = { ${fields} }${SCRIPT_END}`]
      : []),
  ].join('\n')
})
const copied = ref(false)
async function copy() {
  await navigator.clipboard.writeText(embed.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const deleteOpen = ref(false)
const typed = ref('')
const deleteError = ref('')
async function remove() {
  deleteError.value = ''
  try {
    await $fetch(`/api/apps/${id}/delete`, { method: 'POST', body: {} })
    await navigateTo('/apps')
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/apps">Apps</NuxtLink></li>
        <li aria-current="page" class="font-mono">{{ id }}</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this app.</strong> {{ errorMessage(error) }}</div>
    </div>
    <div v-else-if="app" class="stack gap-6">
      <header class="cluster justify-between gap-4">
        <h1 class="text-l weight-600">{{ app.name }}</h1>
        <NuxtLink
          :to="`/?app=${app.id}`"
          class="btn"
          data-icon
          data-size="s"
          data-variant="ghost"
          :aria-label="`Feedback for ${app.id}`"
          :data-tip="`Feedback for ${app.id}`"
          ><i class="icon" data-icon="inbox"></i
        ></NuxtLink>
      </header>

      <div v-if="savedNotice" class="alert" data-tone="success" role="status">
        <div><strong>Saved.</strong> The form uses the new settings from its next load.</div>
      </div>
      <AppForm :key="JSON.stringify(app)" :app="app" @saved="saved" />

      <section class="stack gap-3" aria-labelledby="embed-title">
        <div class="cluster justify-between gap-4">
          <h2 id="embed-title" class="text-s weight-600">Embed</h2>
          <button
            type="button"
            class="btn"
            data-icon
            data-size="s"
            data-variant="ghost"
            :aria-label="copied ? 'Copied' : 'Copy the snippet'"
            :data-tip="copied ? 'Copied' : 'Copy the snippet'"
            @click="copy"
          >
            <i class="icon" :data-icon="copied ? 'check' : 'copy'"></i>
          </button>
        </div>
        <pre class="font-mono text-xs break-words"><code>{{ embed }}</code></pre>
        <small class="text-muted text-s"
          >The form takes its look from the site's aequitas styles and opens wherever you place it,
          for example in a dialog.</small
        >
      </section>

      <section class="stack gap-3 hairline-t pt-5" aria-labelledby="delete-title">
        <h2 id="delete-title" class="text-s weight-600">Delete</h2>
        <p class="text-s text-muted">
          Removes the app and all its feedback. Embedded forms stop working.
        </p>
        <p>
          <button type="button" class="link text-danger" @click="deleteOpen = true">
            Delete {{ app.id }}
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
      confirm-label="Delete app"
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
