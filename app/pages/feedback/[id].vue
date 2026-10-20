<script setup lang="ts">
import type { FeedbackDetail, Status } from '../../../shared/contracts'
import { KIND_LABELS } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { formatTime } from '../../lib/format'

const route = useRoute()
const id = route.params.id as string
const { data: item, error, refresh } = await useFetch<FeedbackDetail>(`/api/feedback/${id}`)
const { name } = useRuntimeConfig().public.nexitas
useHead({ title: () => `${item.value ? KIND_LABELS[item.value.kind] : 'Feedback'} · ${name}` })

const router = useRouter()
/** The inbox view this entry was opened from (the overview, or one app's page), else the overview. */
function inboxBack() {
  const back = router.options.history.state.back
  return typeof back === 'string' && /^\/feedback(\?|$)/.test(back) ? back : '/feedback'
}

const pending = ref(false)
const actionError = ref('')
const deleteOpen = ref(false)

async function setStatus(status: Status) {
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/feedback/${id}/status`, { method: 'POST', body: { status } })
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
    await $fetch(`/api/feedback/${id}/delete`, { method: 'POST', body: {} })
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
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/feedback">Inbox</NuxtLink></li>
        <li v-if="item">
          <NuxtLink :to="`/feedback?app=${item.appId}`" class="font-mono">{{
            item.appId
          }}</NuxtLink>
        </li>
        <li aria-current="page">{{ item ? KIND_LABELS[item.kind] : 'Feedback' }}</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this feedback.</strong> {{ errorMessage(error) }}</div>
    </div>
    <div v-else-if="item" class="stack gap-5">
      <header class="cluster justify-between gap-4">
        <h1 class="text-l weight-600">{{ KIND_LABELS[item.kind] }}</h1>
        <FeedbackState :status="item.status" />
      </header>

      <p class="message">{{ item.message }}</p>

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
              :to="{ path: '/feedback', query: { filter: 'all', q: item.sender } }"
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

      <div v-if="actionError" class="alert" data-tone="danger" role="alert">
        <div><strong>That did not work.</strong> {{ actionError }}</div>
      </div>

      <!-- Text actions, as everywhere in the suite; deleting is the one in danger ink, at the end. -->
      <div class="cluster gap-4 hairline-t pt-4 text-s">
        <button
          v-for="next in NEXT.filter((option) => option.status !== item!.status)"
          :key="next.status"
          type="button"
          class="link"
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
          class="link"
          >Make a GitHub issue</a
        >
        <button
          type="button"
          class="link text-danger end"
          :disabled="pending"
          @click="deleteOpen = true"
        >
          Delete
        </button>
      </div>
    </div>

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
