<script setup lang="ts">
import type { AppSummary, FeedbackPage } from '../../shared/contracts'
import { KIND_LABELS, MAX_SEARCH } from '../../shared/contracts'
import { INBOX_KEY, excerpt, feedbackStates, kindIcons } from '../lib/feedback'
import { formatAge, formatCount, formatDayName } from '#nexitas/app/lib/format'

/** <InboxList :selected="id" aside-title="A problem"><template #aside>…</template></InboxList>
 *  The inbox page: the list in the pane, its filter, search and page in the address. An entry's
 *  page renders it too, with `selected` marking its row and the entry in `aside` (the inspector),
 *  so going through feedback never leaves the list. */
defineProps<{ selected?: string; asideTitle?: string }>()
const slots = defineSlots<{ aside?: () => unknown; danger?: () => unknown }>()

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

// Under a known key, so the entry beside the list can refresh it when it changes the entry's state
// (a ref to this component is not ready before its awaits resolve).
// Both at once: the page waits for one round trip, not two. The form says whether the project
// collects feedback at all, for the empty state, and its unread count and fullness for the lead.
const [{ data, error, refresh }, { data: form }] = await Promise.all([
  useProjectFetch<FeedbackPage>('/feedback', { key: INBOX_KEY, query: { filter, page, q } }),
  useProjectFetch<{ app: AppSummary | null }>('/feedback/form'),
])

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

// What leads the page is what needs the owner, whatever the view: the project's unread feedback,
// and a form so full it turns feedback away. The filters carry the view's own counts.
const headline = computed(() => {
  const fresh = form.value?.app?.newCount
  return fresh ? `${formatCount(fresh)} new feedback` : 'Nothing new'
})
/** "the latest 12 min ago": on the first page (newest first), how fresh the view is. */
const meta = computed(() => {
  const latest = page.value === 1 ? data.value?.items[0]?.createdAt : undefined
  return [
    form.value?.app?.full ? 'the form is full and turns feedback away' : '',
    latest ? `the latest ${formatAge(latest)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

// The page's rows by UTC day, newest first, like the overview's story.
const days = computed(() => {
  const groups: { name: string; items: FeedbackPage['items'] }[] = []
  for (const item of data.value?.items ?? []) {
    const name = formatDayName(item.createdAt)
    let group = groups.at(-1)
    if (group?.name !== name) groups.push((group = { name, items: [] }))
    group.items.push(item)
  }
  return groups
})

const empty = computed(() =>
  q.value
    ? `Nothing matches “${q.value}” here.`
    : filter.value === 'open'
      ? 'All read. New feedback shows up here.'
      : 'Nothing here.',
)
</script>

<template>
  <AppPage
    title="Feedback"
    failed="Could not load the feedback."
    :error="error"
    :retry="refresh"
    :aside-title="asideTitle"
    :aside-close="slots.aside ? { path: `/p/${project}/feedback`, query: route.query } : undefined"
  >
    <template v-if="form?.app" #actions>
      <NuxtLink :to="`/p/${project}/feedback/_form`" class="btn" data-size="s"
        >Form settings</NuxtLink
      >
    </template>
    <template v-if="form?.app" #lead>
      <AppLead :title="headline">
        <template v-if="meta" #meta>{{ meta }}</template>
      </AppLead>
    </template>
    <template #filters>
      <FilterLinks
        label="Show"
        :options="
          FILTERS.map((option) => ({
            label: option.label,
            to: inbox({ filter: option.value }),
            current: filter === option.value,
          }))
        "
      />
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
          <template v-for="day in days" :key="day.name">
            <tr>
              <th scope="rowgroup" colspan="3" class="text-xs text-muted weight-600">
                {{ day.name }}
              </th>
            </tr>
            <tr
              v-for="item in day.items"
              :key="item.id"
              :aria-selected="item.id === selected ? 'true' : undefined"
            >
              <td>
                <StateDot :tone="feedbackStates[item.status].tone">
                  <!-- Unread stands in full ink and weight; what has been read recedes to muted,
                     so the difference is one of contrast, not only of weight. -->
                  <NuxtLink
                    :to="{ path: `/p/${project}/feedback/${item.id}`, query: route.query }"
                    class="link row-title min-w-0 break-words"
                    :class="item.status === 'new' ? 'weight-600' : 'text-muted'"
                    data-quiet
                    >{{ excerpt(item.message) }}</NuxtLink
                  >
                  <span class="sr-only">{{ feedbackStates[item.status].label }}</span>
                </StateDot>
              </td>
              <td>
                <span class="cluster flex-nowrap items-center gap-2 nowrap text-muted">
                  <i
                    class="icon"
                    :data-icon="kindIcons[item.kind]"
                    data-size="s"
                    aria-hidden="true"
                  ></i
                  >{{ KIND_LABELS[item.kind] }}
                </span>
              </td>
              <td data-num class="text-muted">
                <time>{{ formatAge(item.createdAt) }}</time>
              </td>
            </tr>
          </template>
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

    <template v-if="slots.aside" #aside><slot name="aside" /></template>
    <template v-if="slots.danger" #danger><slot name="danger" /></template>
  </AppPage>
</template>
