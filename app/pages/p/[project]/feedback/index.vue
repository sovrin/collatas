<script setup lang="ts">
import type { AppSummary, FeedbackPage } from '../../../../../shared/contracts'
import { KIND_LABELS, MAX_SEARCH } from '../../../../../shared/contracts'
import { excerpt, feedbackStates, kindIcons } from '../../../../lib/feedback'
import { formatAge, formatCount } from '#nexitas/app/lib/format'

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'spam', label: 'Spam' },
  { value: 'all', label: 'All' },
]

const project = useProject().id.value
const route = useRoute()
const filter = computed(() =>
  typeof route.query.filter === 'string' ? route.query.filter : 'open',
)
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const view = computed(() => `${filter.value}|${page.value}|${q.value}`)

const { data, error, refresh } = await useProjectFetch<FeedbackPage>('/feedback', {
  query: { filter, page, q },
})
// Whether the project collects feedback at all, for the empty state.
const { data: form } = await useProjectFetch<{ app: AppSummary | null }>('/feedback/form')

/** The inbox address for a filter, page or search, leaving out the defaults. Anything new starts
 *  on the first page. */
function inbox(next: { filter?: string; page?: number; q?: string }) {
  const query = { filter: filter.value, page: 1, q: q.value, ...next }
  return {
    path: `/p/${project}/feedback`,
    query: {
      ...(query.filter !== 'open' ? { filter: query.filter } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.page > 1 ? { page: String(query.page) } : {}),
    },
  }
}

// The field follows the address (back button, the sender link), and searches on Enter or clear.
const searchText = ref(q.value)
watch(q, (value) => (searchText.value = value))
const search = () => navigateTo(inbox({ q: searchText.value.trim() }))

/** "4 open", "2 done", "7 in total": what the view holds when nothing in it is new. */
const countLabel = (count: number) =>
  `${formatCount(count)} ${filter.value === 'all' ? 'in total' : filter.value}`

const empty = computed(() =>
  q.value
    ? `Nothing matches “${q.value}” here.`
    : filter.value === 'open'
      ? 'All read. New feedback shows up here.'
      : 'Nothing here.',
)
</script>

<template>
  <AppPage title="Inbox" failed="Could not load the inbox." :error="error" :retry="refresh">
    <!-- A tone only where the owner is needed: unread feedback. -->
    <template v-if="data?.total" #subtitle>
      <StateDot v-if="data.newCount" tone="warning">{{ formatCount(data.newCount) }} new</StateDot>
      <template v-else>{{ countLabel(data.total) }}</template>
    </template>
    <template #actions>
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
      <SearchBox
        v-model="searchText"
        label="Search feedback: words, a sender tag, an email"
        :maxlength="MAX_SEARCH"
        @search="search"
      />
    </template>

    <EmptyState v-if="form && !form.app">
      Feedback is not collected for this project.
      <NuxtLink :to="`/p/${project}`" class="link">Collect it on its page</NuxtLink>, then embed its
      form.
    </EmptyState>
    <div v-else-if="data?.items.length" class="stack gap-6">
      <DataTable label="Feedback">
        <thead>
          <tr>
            <th scope="col">Message</th>
            <th scope="col">Kind</th>
            <th scope="col" data-num>Received</th>
          </tr>
        </thead>
        <!-- Rows animate only while the view stays the same (live arrivals, status changes); a
             new filter or page replaces the list at once, keyed by the view. -->
        <TransitionGroup :key="view" tag="tbody" name="row" class="relative">
          <tr v-for="item in data.items" :key="item.id">
            <td>
              <StateDot :tone="feedbackStates[item.status].tone">
                <!-- Unread stands in full ink and weight; what has been read recedes to muted,
                     so the difference is one of contrast, not only of weight. -->
                <NuxtLink
                  :to="`/p/${project}/feedback/${item.id}`"
                  class="link row-title min-w-0 break-words"
                  :class="item.status === 'new' ? 'weight-600' : 'text-muted'"
                  data-quiet
                  >{{ excerpt(item.message) }}</NuxtLink
                >
                <span class="sr-only">{{ feedbackStates[item.status].label }}</span>
              </StateDot>
            </td>
            <td>
              <i
                class="icon text-muted"
                :data-icon="kindIcons[item.kind]"
                data-size="s"
                role="img"
                :aria-label="KIND_LABELS[item.kind]"
                :data-tip="KIND_LABELS[item.kind]"
              ></i>
            </td>
            <td data-num class="text-muted">
              <time>{{ formatAge(item.createdAt) }}</time>
            </td>
          </tr>
        </TransitionGroup>
      </DataTable>

      <!-- A page at a time: the page is in the address, so polling, reload and the back button
           all keep it. -->
      <PagerNav
        :page="page"
        :page-size="data.pageSize"
        :total="data.total"
        :to="(next) => inbox({ page: next })"
      />
    </div>
    <EmptyState v-else-if="data">
      {{ page > 1 ? 'No feedback on this page.' : empty }}
    </EmptyState>
  </AppPage>
</template>
