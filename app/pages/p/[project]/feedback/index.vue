<script setup lang="ts">
import type { AppSummary, FeedbackPage } from '../../../../../shared/contracts'
import { KIND_LABELS, MAX_SEARCH } from '../../../../../shared/contracts'
import { excerpt, feedbackStates, kindIcons } from '../../../../lib/feedback'
import { errorMessage, formatAge, formatCount } from '#nexitas/app/lib/format'

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
useHead({ title: `Inbox · ${project}` })

const { data, error, refresh } = await useFetch<FeedbackPage>(`/api/p/${project}/feedback`, {
  query: { filter, page, q },
})
// Whether the project collects feedback at all, for the empty state.
const { data: form } = await useFetch<{ app: AppSummary | null }>(`/api/p/${project}/feedback/form`)
useLive(refresh)

const pages = computed(() =>
  data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1,
)

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
  <div class="stack gap-5">
    <div class="page-header">
      <div class="stack gap-1 min-w-0">
        <h1 class="text-xl weight-600">Inbox</h1>
        <!-- A tone only where the owner is needed: unread feedback. -->
        <p v-if="data?.total" class="text-s">
          <span v-if="data.newCount" class="cluster gap-2"
            ><span class="dot" data-tone="warning" aria-hidden="true"></span
            >{{ formatCount(data.newCount) }} new</span
          >
          <span v-else class="text-muted">{{ countLabel(data.total) }}</span>
        </p>
      </div>
      <div class="cluster gap-4">
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
        <form role="search" @submit.prevent="search">
          <input
            v-model="searchText"
            class="input text-s"
            data-size="s"
            type="search"
            placeholder="Search"
            aria-label="Search feedback: words, a sender tag, an email"
            :maxlength="MAX_SEARCH"
            @search="search"
          />
        </form>
      </div>
    </div>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load the inbox.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <p v-else-if="form && !form.app" class="text-muted">
      Feedback is not collected for this project.
      <NuxtLink :to="`/p/${project}`" class="link">Collect it on its page</NuxtLink>, then embed its
      form.
    </p>
    <div v-else-if="data?.items.length" class="stack gap-6">
      <div class="table-scroll">
        <table class="table" data-size="s" aria-label="Feedback">
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
                <span class="cluster gap-3 flex-nowrap">
                  <span
                    class="dot"
                    :data-tone="feedbackStates[item.status].tone"
                    aria-hidden="true"
                  ></span>
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
                </span>
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
        </table>
      </div>

      <!-- A page at a time: the page is in the address, so polling, reload and the back button
           all keep it. -->
      <nav v-if="pages > 1" class="cluster justify-between gap-4 text-s" aria-label="Pages">
        <NuxtLink v-if="page > 1" :to="inbox({ page: page - 1 })" class="link">Newer</NuxtLink>
        <span v-else></span>
        <span class="text-muted tabular"
          >{{ formatCount((page - 1) * data.pageSize + 1) }}–{{
            formatCount(Math.min(page * data.pageSize, data.total))
          }}
          of {{ formatCount(data.total) }}</span
        >
        <NuxtLink v-if="page < pages" :to="inbox({ page: page + 1 })" class="link">Older</NuxtLink>
        <span v-else></span>
      </nav>
    </div>
    <p v-else-if="data" class="text-muted">
      {{ page > 1 ? 'No feedback on this page.' : empty }}
    </p>
  </div>
</template>
