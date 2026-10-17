<script setup lang="ts">
import type { FeedbackDetail, Status } from '#shared/contracts'
import { KIND_LABELS } from '#shared/contracts'
import { errorMessage, formatTime } from '~/lib/format'

const route = useRoute()
const id = route.params.id as string
const { data: item, error, refresh } = await useFetch<FeedbackDetail>(`/api/feedback/${id}`)
useHead({ title: () => `${item.value ? KIND_LABELS[item.value.kind] : 'Feedback'} · collatas` })

const router = useRouter()
/** The inbox view this entry was opened from (the overview, or one app's page), else the overview. */
function inboxBack() {
  const back = router.options.history.state.back
  return typeof back === 'string' && /^\/(\?|$)/.test(back) ? back : '/'
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

const NEXT: { status: Status; label: string; icon: string }[] = [
  { status: 'done', label: 'Mark done', icon: 'check' },
  { status: 'spam', label: 'Mark spam', icon: 'ban' },
  { status: 'new', label: 'Mark unread and go back', icon: 'mail' },
]
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/">Inbox</NuxtLink></li>
        <li v-if="item">
          <NuxtLink :to="`/?app=${item.appId}`" class="font-mono">{{ item.appId }}</NuxtLink>
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
        <dt>App</dt>
        <dd>
          <NuxtLink :to="`/apps/${item.appId}`" class="link font-mono" data-quiet>{{
            item.appName
          }}</NuxtLink>
        </dd>
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
        <template v-for="(value, key) in item.context" :key="key">
          <dt class="font-mono">{{ key }}</dt>
          <dd class="font-mono break-words">{{ value }}</dd>
        </template>
      </dl>

      <div v-if="actionError" class="alert" data-tone="danger" role="alert">
        <div><strong>That did not work.</strong> {{ actionError }}</div>
      </div>

      <div class="cluster gap-1 hairline-t pt-4">
        <a
          v-if="item.issueLink"
          :href="item.issueLink"
          target="_blank"
          rel="noopener noreferrer"
          class="btn"
          data-icon
          data-size="s"
          data-variant="ghost"
          aria-label="Make a GitHub issue"
          data-tip="Make a GitHub issue"
          ><i class="icon" data-icon="circle-dot"></i
        ></a>
        <button
          v-for="next in NEXT.filter((option) => option.status !== item!.status)"
          :key="next.status"
          type="button"
          class="btn"
          data-icon
          data-size="s"
          data-variant="ghost"
          :aria-label="next.label"
          :data-tip="next.label"
          :disabled="pending"
          @click="setStatus(next.status)"
        >
          <i class="icon" :data-icon="next.icon"></i>
        </button>
        <button
          type="button"
          class="btn end"
          data-icon
          data-size="s"
          data-variant="ghost"
          data-tone="danger"
          aria-label="Delete"
          data-tip="Delete"
          :disabled="pending"
          @click="deleteOpen = true"
        >
          <i class="icon" data-icon="trash"></i>
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
      <template #description>It is gone for good, including the sender's email.</template>
    </ConfirmDialog>
  </div>
</template>
