<script setup lang="ts">
import type { FeedbackDetail, Status } from '../../../../../shared/contracts'
import { KIND_LABELS } from '../../../../../shared/contracts'
import { errorMessage, formatTime } from '#nexitas/app/lib/format'

const project = useProject().id.value
const id = useRoute().params.id as string
const inbox = `/p/${project}/feedback`
const api = `/api/p/${project}/feedback/${id}`
const { data: item, error, refresh } = await useProjectFetch<FeedbackDetail>(`/feedback/${id}`)

const router = useRouter()
/** The inbox view this entry was opened from (a filter, a search, a page), else the inbox. */
function inboxBack() {
  const back = router.options.history.state.back
  return typeof back === 'string' && (back === inbox || back.startsWith(`${inbox}?`)) ? back : inbox
}

const pending = ref(false)
const actionError = ref('')

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
  <AppPage
    :title="item ? KIND_LABELS[item.kind] : 'Feedback'"
    failed="Could not load this feedback."
    :error="error"
  >
    <template v-if="item" #subtitle><FeedbackState :status="item.status" /></template>
    <!-- Done is what most feedback ends as, so it leads; deleting is the one in danger ink, at
         the end. -->
    <template v-if="item" #actions>
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
      <DangerAction
        label="Delete"
        title="Delete this feedback?"
        :pending="pending"
        @confirm="remove"
      >
        This cannot be undone.
      </DangerAction>
    </template>

    <!-- The message takes the room; where it came from sits beside it. -->
    <template v-if="item">
      <AppAlert v-if="actionError" title="That did not work.">{{ actionError }}</AppAlert>
      <p class="snippet min-w-0">{{ item.message }}</p>
    </template>

    <template v-if="item" #aside>
      <AppSection title="Details">
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
      </AppSection>
    </template>
  </AppPage>
</template>
