<script setup lang="ts">
import type { FeedbackDetail, Status } from '../../../../../shared/contracts'
import { KIND_LABELS } from '../../../../../shared/contracts'
import { errorMessage, formatTime } from '#nexitas/app/lib/format'

const project = useProject().id.value
const id = useRoute().params.id as string
const inbox = `/p/${project}/feedback`
const api = `/api/p/${project}/feedback/${id}`
const { data: item, error, refresh } = await useFetch<FeedbackDetail>(api)
useHead({ title: () => `${item.value ? KIND_LABELS[item.value.kind] : 'Feedback'} · ${project}` })

const router = useRouter()
/** The inbox view this entry was opened from (a filter, a search, a page), else the inbox. */
function inboxBack() {
  const back = router.options.history.state.back
  return typeof back === 'string' && (back === inbox || back.startsWith(`${inbox}?`)) ? back : inbox
}

const pending = ref(false)
const actionError = ref('')
const deleteOpen = ref(false)

async function setStatus(status: Status) {
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`${api}/status`, { method: 'POST', body: { status } })
    // Unread means "not now": straight back to the inbox, where it shows as new again.
    if (status === 'new') return await navigateTo(inboxBack())
    await refresh()
  } catch (cause) {
    actionError.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}

async function remove() {
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`${api}/delete`, { method: 'POST', body: {} })
    await navigateTo(inboxBack())
  } catch (cause) {
    actionError.value = errorMessage(cause)
    pending.value = false
  }
}

// Opening a new entry is reading it.
onMounted(() => {
  if (item.value?.status === 'new') setStatus('seen')
})

const NEXT: { status: Status; label: string }[] = [
  { status: 'done', label: 'Mark done' },
  { status: 'spam', label: 'Mark spam' },
  { status: 'new', label: 'Mark unread and go back' },
]
</script>

<template>
  <div class="stack gap-5">
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li><NuxtLink :to="inbox">Inbox</NuxtLink></li>
        <li aria-current="page">{{ item ? KIND_LABELS[item.kind] : 'Feedback' }}</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this feedback.</strong> {{ errorMessage(error) }}</div>
    </div>
    <template v-else-if="item">
      <div class="page-header">
        <div class="stack gap-1 min-w-0">
          <h1 class="text-xl weight-600">{{ KIND_LABELS[item.kind] }}</h1>
          <p class="text-s text-muted"><FeedbackState :status="item.status" /></p>
        </div>
        <!-- Done is what most feedback ends as, so it leads; deleting is the one in danger ink, at
             the end. -->
        <div class="cluster gap-2">
          <button
            v-for="next in NEXT.filter((option) => option.status !== item!.status)"
            :key="next.status"
            type="button"
            class="btn"
            data-size="s"
            :data-variant="next.status === 'done' ? 'primary' : undefined"
            :disabled="pending"
            @click="setStatus(next.status)"
          >
            {{ next.label }}
          </button>
          <a
            v-if="item.issueLink"
            :href="item.issueLink"
            target="_blank"
            rel="noopener noreferrer"
            class="btn"
            data-size="s"
            >Make a GitHub issue</a
          >
          <button
            type="button"
            class="btn"
            data-size="s"
            data-variant="ghost"
            data-tone="danger"
            :disabled="pending"
            @click="deleteOpen = true"
          >
            Delete
          </button>
        </div>
      </div>
      <div v-if="actionError" class="alert" data-tone="danger" role="alert">
        <div><strong>That did not work.</strong> {{ actionError }}</div>
      </div>

      <!-- The message takes the room; where it came from sits beside it. -->
      <div class="with-aside">
        <p class="snippet min-w-0">{{ item.message }}</p>

        <aside class="stack gap-3" aria-labelledby="details-title">
          <h2 id="details-title" class="text-s weight-600 hairline-b pb-2">Details</h2>
          <dl class="properties">
            <dt>Received</dt>
            <dd class="font-mono">{{ formatTime(item.createdAt) }}</dd>
            <dt>Reply to</dt>
            <dd class="font-mono break-words">
              <a v-if="item.email" :href="`mailto:${item.email}`" class="link">{{ item.email }}</a>
              <span v-else class="text-muted">no email given</span>
            </dd>
            <template v-if="item.page">
              <dt>Page</dt>
              <dd class="font-mono break-words">
                <a :href="item.page" target="_blank" rel="noopener noreferrer" class="link">{{
                  item.page
                }}</a>
              </dd>
            </template>
            <template v-if="item.sender">
              <dt>Sender</dt>
              <dd>
                <NuxtLink
                  :to="{ path: inbox, query: { filter: 'all', q: item.sender } }"
                  class="link font-mono"
                  >{{ item.sender }}</NuxtLink
                >
                <span v-if="item.sameSender" class="text-muted text-s">
                  · the same on their other feedback that day</span
                >
              </dd>
            </template>
            <template v-for="(value, key) in item.context" :key="key">
              <dt class="font-mono">{{ key }}</dt>
              <dd class="font-mono break-words">{{ value }}</dd>
            </template>
          </dl>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete this feedback?"
      confirm-label="Delete"
      tone="danger"
      @confirm="remove"
    >
      <template #description>This cannot be undone.</template>
    </ConfirmDialog>
  </div>
</template>
