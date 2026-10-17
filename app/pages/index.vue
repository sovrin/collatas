<script setup lang="ts">
import type { AppSummary, FeedbackPage, InboxGroup } from '#shared/contracts'
import { KIND_LABELS } from '#shared/contracts'
import { excerpt, feedbackStates, kindIcons } from '~/lib/feedback'
import { errorMessage, formatAge } from '~/lib/format'

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
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
useHead({ title: () => `${app.value ? `${app.value} · ` : ''}Inbox · collatas` })

// Across all apps the server sends each app's counts and newest few; one app's view is paged.
const { data, error, refresh } = await useFetch<InboxGroup[] | FeedbackPage>(
  () => (app.value ? '/api/feedback' : '/api/inbox'),
  { query: { filter, app, page } },
)
const { data: apps } = await useFetch<AppSummary[]>('/api/apps')
usePolling(refresh)

/** Both answers as groups, so one list renders them. */
const groups = computed<InboxGroup[]>(() => {
  const value = data.value
  if (!value) return []
  if (Array.isArray(value)) return value
  if (!value.total) return []
  return [
    {
      appId: app.value,
      appName: value.items[0]?.appName ?? app.value,
      newCount: value.newCount,
      total: value.total,
      items: value.items,
    },
  ]
})
const paged = computed(() => (data.value && !Array.isArray(data.value) ? data.value : null))
const pages = computed(() =>
  paged.value ? Math.max(1, Math.ceil(paged.value.total / paged.value.pageSize)) : 1,
)

/** The inbox address for a filter, app or page, leaving out the defaults. A new filter or app
 *  starts on the first page. */
function inbox(next: { filter?: string; app?: string; page?: number }) {
  const query = { filter: filter.value, app: app.value, page: 1, ...next }
  return {
    path: '/',
    query: {
      ...(query.filter !== 'open' ? { filter: query.filter } : {}),
      ...(query.app ? { app: query.app } : {}),
      ...(query.page > 1 ? { page: String(query.page) } : {}),
    },
  }
}

/** "4 open", "2 done", "7 in total": what a group holds when nothing in it is new. */
const countLabel = (count: number) =>
  `${count} ${filter.value === 'all' ? 'in total' : filter.value}`

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
    <h1 class="sr-only">{{ app ? `Inbox of ${app}` : 'Inbox' }}</h1>
    <nav v-if="app" aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li><NuxtLink :to="inbox({ app: '' })">All apps</NuxtLink></li>
        <li aria-current="page" class="font-mono">{{ app }}</li>
      </ol>
    </nav>
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

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load the inbox.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <div v-else-if="groups.length" class="stack gap-6">
      <section
        v-for="group in groups"
        :key="group.appId"
        class="stack gap-1"
        :aria-labelledby="`app-${group.appId}`"
      >
        <div class="cluster justify-between gap-4 flex-nowrap">
          <h2 :id="`app-${group.appId}`" class="text-s weight-600 min-w-0 break-words">
            <NuxtLink
              v-if="!app"
              :to="inbox({ app: group.appId })"
              class="link font-mono"
              data-quiet
              >{{ group.appId }}</NuxtLink
            >
            <span v-else class="font-mono">{{ group.appId }}</span>
          </h2>
          <!-- Colour only where the owner is needed: unread feedback. -->
          <span v-if="group.newCount" class="text-s text-warning">{{ group.newCount }} new</span>
          <span v-else class="text-s text-muted">{{ countLabel(group.total) }}</span>
        </div>
        <ul data-variant="plain" :aria-label="`Feedback for ${group.appId}`">
          <li v-for="item in group.items" :key="item.id" class="py-3 hairline-b">
            <div class="cluster gap-3 flex-nowrap">
              <span
                class="dot"
                :data-tone="feedbackStates[item.status].tone"
                aria-hidden="true"
              ></span>
              <!-- Unread stands in full ink and weight; what has been read recedes to muted, so
                   the difference is one of contrast, not only of weight. -->
              <NuxtLink
                :to="`/feedback/${item.id}`"
                class="link flex-1 min-w-0 truncate"
                :class="item.status === 'new' ? 'weight-600' : 'text-muted'"
                data-quiet
                >{{ excerpt(item.message) }}</NuxtLink
              >
              <span class="sr-only">{{ feedbackStates[item.status].label }}</span>
              <i
                class="icon text-muted"
                :data-icon="kindIcons[item.kind]"
                data-size="s"
                role="img"
                :aria-label="KIND_LABELS[item.kind]"
                :data-tip="KIND_LABELS[item.kind]"
              ></i>
              <time class="text-s text-muted tabular">{{ formatAge(item.createdAt) }}</time>
            </div>
          </li>
        </ul>
        <p v-if="!app && group.total > group.items.length" class="pt-2">
          <NuxtLink :to="inbox({ app: group.appId })" class="link text-s"
            >{{ group.total - group.items.length }} more from
            <span class="font-mono">{{ group.appId }}</span></NuxtLink
          >
        </p>
      </section>

      <!-- One app's feedback, a page at a time: the page is in the address, so polling, reload and
           the back button all keep it. -->
      <nav
        v-if="paged && pages > 1"
        class="cluster justify-between gap-4 text-s"
        aria-label="Pages"
      >
        <NuxtLink v-if="page > 1" :to="inbox({ page: page - 1 })" class="link">Newer</NuxtLink>
        <span v-else></span>
        <span class="text-muted tabular"
          >{{ (page - 1) * paged.pageSize + 1 }}–{{
            Math.min(page * paged.pageSize, paged.total)
          }}
          of {{ paged.total }}</span
        >
        <NuxtLink v-if="page < pages" :to="inbox({ page: page + 1 })" class="link">Older</NuxtLink>
        <span v-else></span>
      </nav>
    </div>
    <p v-else-if="data" class="text-muted">
      {{ paged && page > 1 ? 'No feedback on this page.' : empty }}
    </p>
  </div>
</template>
