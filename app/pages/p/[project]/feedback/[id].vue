<script setup lang="ts">
import type { FeedbackDetail, Status } from '../../../../../shared/contracts'
import { KIND_LABELS } from '../../../../../shared/contracts'
import { errorMessage, formatTime } from '#nexitas/app/lib/format'
import { INBOX_KEY } from '../../../../lib/feedback'

const project = useProject().id.value
const route = useRoute()
const id = route.params.id as string
const api = `/api/p/${project}/feedback/${id}`
const { data: item, error, refresh } = await useProjectFetch<FeedbackDetail>(`/feedback/${id}`)

/** The inbox as it stands beside the entry (its filter, search and page), without the entry. */
const inbox = () => navigateTo({ path: `/p/${project}/feedback`, query: route.query })

const pending = ref(false)
const statusButtons = useTemplateRef<HTMLElement>('statusButtons')
const actionError = ref('')

/** `byClick`: the owner pressed a status button, which the new state removes. */
async function setStatus(status: Status, byClick = false) {
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`${api}/status`, { method: 'POST', body: { status } })
    // Unread means "not now": back to the inbox alone, where it shows as new again.
    if (status === 'new') return await inbox()
    await Promise.all([refresh(), refreshNuxtData(INBOX_KEY)])
    // The clicked button is gone with the old state: focus the first one left.
    if (byClick) {
      await nextTick()
      statusButtons.value?.querySelector('button')?.focus()
    }
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
    await inbox()
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
  <InboxList :selected="id" :aside-title="item ? KIND_LABELS[item.kind] : undefined">
    <template #aside>
      <AppAlert v-if="error" title="Could not load this feedback.">{{
        errorMessage(error)
      }}</AppAlert>
      <template v-else-if="item">
        <AppAlert v-if="actionError" title="Could not change this feedback.">{{
          actionError
        }}</AppAlert>
        <!-- The kind names the inspector. Read, then act: the state and the message lead, what
             changes the state follows them. -->
        <div class="stack gap-2">
          <FeedbackState :status="item.status" />
          <p class="snippet min-w-0">{{ item.message }}</p>
        </div>
        <!-- Done is what most feedback ends as, so it leads, in the module's hue. -->
        <div ref="statusButtons" class="cluster gap-2">
          <button
            v-for="next in NEXT.filter((option) => option.status !== item!.status)"
            :key="next.status"
            type="button"
            class="btn"
            data-size="s"
            :data-variant="next.status === 'done' ? 'primary' : undefined"
            :disabled="pending"
            :aria-busy="pending || undefined"
            @click="setStatus(next.status, true)"
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
            >Make an issue</a
          >
        </div>

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
                :to="{ path: `/p/${project}/feedback`, query: { filter: 'all', q: item.sender } }"
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
      </template>
    </template>
    <template v-if="item" #danger>
      <span>Removes this feedback for good.</span>
      <DangerAction
        label="Delete feedback"
        title="Delete this feedback?"
        :pending="pending"
        @confirm="remove"
      >
        This cannot be undone.
      </DangerAction>
    </template>
  </InboxList>
</template>
