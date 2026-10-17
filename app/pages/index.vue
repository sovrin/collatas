<script setup lang="ts">
import type { AppSummary, FeedbackItem } from '#shared/contracts'
import { KIND_LABELS } from '#shared/contracts'
import { excerpt, feedbackStates } from '~/lib/feedback'
import { errorMessage, formatAge } from '~/lib/format'
useHead({ title: 'Inbox · collatas' })

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'spam', label: 'Spam' },
  { value: 'all', label: 'All' },
]
const route = useRoute()
const filter = computed(() =>
  typeof route.query.filter === 'string' ? route.query.filter : 'open',
)
const app = computed(() => (typeof route.query.app === 'string' ? route.query.app : ''))
const { data, error, refresh } = await useFetch<FeedbackItem[]>('/api/feedback', {
  query: { filter, app },
})
const { data: apps } = await useFetch<AppSummary[]>('/api/apps')
usePolling(refresh)

/** The inbox address for a filter or app, leaving out the defaults. */
function inbox(next: { filter?: string; app?: string }) {
  const query = { filter: filter.value, app: app.value, ...next }
  return {
    path: '/',
    query: {
      ...(query.filter !== 'open' ? { filter: query.filter } : {}),
      ...(query.app ? { app: query.app } : {}),
    },
  }
}
const empty = computed(() =>
  !apps.value?.length
    ? 'Nothing yet. Register an app under Apps and embed its form.'
    : filter.value === 'open'
      ? 'All read. New feedback shows up here.'
      : 'Nothing here.',
)
</script>

<template>
  <div class="stack gap-5">
    <h1 class="sr-only">Inbox</h1>
    <div class="cluster justify-between gap-4">
      <span class="cluster gap-3 text-s" role="group" aria-label="Show">
        <NuxtLink
          v-for="option in FILTERS"
          :key="option.value"
          :to="inbox({ filter: option.value })"
          class="link"
          :data-quiet="filter === option.value ? undefined : ''"
          :aria-current="filter === option.value ? 'page' : undefined"
          >{{ option.label }}</NuxtLink
        >
      </span>
      <div v-if="apps && apps.length > 1" class="select">
        <select
          class="input font-mono text-s"
          aria-label="App"
          :value="app"
          @change="navigateTo(inbox({ app: ($event.target as HTMLSelectElement).value }))"
        >
          <option value="">all apps</option>
          <option v-for="option in apps" :key="option.id" :value="option.id">
            {{ option.id }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load the inbox.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <ul v-else-if="data?.length" data-variant="plain" aria-label="Feedback">
      <li v-for="item in data" :key="item.id" class="py-3 hairline-b">
        <div class="cluster gap-3 flex-nowrap">
          <span class="dot" :data-tone="feedbackStates[item.status].tone" aria-hidden="true"></span>
          <NuxtLink
            :to="`/feedback/${item.id}`"
            class="link flex-1 min-w-0 truncate"
            :class="{ 'weight-600': item.status === 'new' }"
            data-quiet
            >{{ excerpt(item.message) }}</NuxtLink
          >
          <span class="sr-only">{{ feedbackStates[item.status].label }}</span>
          <time class="text-s text-muted tabular">{{ formatAge(item.createdAt) }}</time>
        </div>
        <p class="ps-4 font-mono text-xs text-muted">
          {{ item.appId }} · {{ KIND_LABELS[item.kind].toLowerCase() }}
        </p>
      </li>
    </ul>
    <p v-else-if="data" class="text-muted">{{ empty }}</p>
  </div>
</template>
