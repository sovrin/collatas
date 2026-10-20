<script setup lang="ts">
import type { AppConfig, AppSettings, ContextField } from '../../shared/contracts'
import { KIND_LABELS, KINDS, MAX_MESSAGE } from '../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'

/** Changes what an app's form offers. Its name and the sites that may send are its project's,
 *  set on the project's page, so nothing about an app is configured in files. */
const props = defineProps<{ app: AppConfig }>()
const emit = defineEmits<{ saved: [AppConfig] }>()

const kinds = ref<string[]>(props.app.kinds)
const context = ref<ContextField[]>(props.app.context.map((field) => ({ ...field })))
const sendPage = ref(props.app.sendPage)
const issueRepo = ref(props.app.issueRepo)
const retentionDays = ref(props.app.retentionDays)
const maxMessage = ref(props.app.maxMessage)
const maxFeedback = ref(props.app.maxFeedback)
const maxStorageMb = ref(props.app.maxStorageMb)
const enabled = ref(props.app.enabled)
const moreOpen = ref(false)

const pending = ref(false)
const error = ref('')
const issues = ref<{ path: string; message: string }[]>([])
const fieldError = (path: string) =>
  issues.value.find((issue) => issue.path === path || issue.path.startsWith(`${path}.`))?.message

function addField() {
  context.value.push({ key: '', max: 200 })
  moreOpen.value = true
}

async function save() {
  pending.value = true
  error.value = ''
  issues.value = []
  const body: AppSettings = {
    kinds: KINDS.filter((kind) => kinds.value.includes(kind)),
    context: context.value.map((field) => ({ key: field.key.trim(), max: Number(field.max) })),
    sendPage: sendPage.value,
    issueRepo: issueRepo.value,
    retentionDays: Number(retentionDays.value),
    maxMessage: Number(maxMessage.value),
    maxFeedback: Number(maxFeedback.value),
    maxStorageMb: Number(maxStorageMb.value),
    enabled: enabled.value,
  }
  try {
    const saved = await $fetch<AppConfig>(`/api/apps/${props.app.id}`, { method: 'POST', body })
    emit('saved', saved)
  } catch (cause) {
    const data = (cause as { data?: { data?: { issues?: typeof issues.value } } }).data?.data
    if (data?.issues?.length) {
      issues.value = data.issues
      // A problem in a hidden setting opens them, so it can be seen.
      if (issues.value.some((issue) => issue.path.split('.')[0] !== 'kinds')) moreOpen.value = true
    } else error.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="stack gap-5" @submit.prevent="save">
    <fieldset :disabled="pending" class="stack gap-5">
      <!-- What every app needs, as one short list; the rest is behind More settings. -->
      <dl class="properties">
        <dt>Offers</dt>
        <dd class="field">
          <div class="cluster gap-4" role="group" aria-label="Kinds of feedback">
            <label v-for="kind in KINDS" :key="kind">
              <input v-model="kinds" type="checkbox" :value="kind" />
              {{ KIND_LABELS[kind] }}
            </label>
          </div>
          <span v-if="fieldError('kinds')" data-error class="text-danger">{{
            fieldError('kinds')
          }}</span>
        </dd>
      </dl>

      <p class="text-s">
        <button
          type="button"
          class="link"
          :aria-expanded="moreOpen"
          aria-controls="more-settings"
          @click="moreOpen = !moreOpen"
        >
          More settings
        </button>
        <span class="text-muted"> context, page address, GitHub, retention, limits, pausing</span>
      </p>

      <div v-show="moreOpen" id="more-settings" class="stack gap-5">
        <div class="stack gap-3">
          <div class="stack gap-1">
            <span class="text-s weight-600">Context</span>
            <small class="text-muted text-s"
              >What the app may send along, like its version or a settings code. People see it
              before they send.</small
            >
          </div>
          <div
            v-for="(field, index) in context"
            :key="index"
            class="cluster gap-3 flex-nowrap items-start"
          >
            <input
              v-model="field.key"
              class="input font-mono text-s flex-1 min-w-0"
              data-size="s"
              :aria-label="`Context field ${index + 1}: name`"
              placeholder="version"
              required
              spellcheck="false"
              :aria-invalid="!!fieldError(`context.${index}`) || undefined"
            />
            <input
              v-model.number="field.max"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="1"
              max="2000"
              :aria-label="`Context field ${index + 1}: longest value`"
              style="inline-size: 6rem"
            />
            <button
              type="button"
              class="btn"
              data-icon
              data-size="s"
              data-variant="ghost"
              :aria-label="`Remove context field ${index + 1}`"
              data-tip="Remove"
              @click="context.splice(index, 1)"
            >
              <i class="icon" data-icon="x"></i>
            </button>
          </div>
          <span v-if="fieldError('context')" class="text-s text-danger">{{
            fieldError('context')
          }}</span>
          <p>
            <button type="button" class="link text-s" @click="addField">Add a context field</button>
          </p>
        </div>

        <div class="stack gap-1">
          <label><input v-model="sendPage" type="checkbox" /> Send the page address</label>
          <small class="text-muted text-s ps-5"
            >Each feedback can open the page it was sent from, with its query and state. Turn it off
            if the app's addresses hold private data.</small
          >
        </div>

        <div class="field">
          <label for="issue-repo">GitHub repository</label>
          <input
            id="issue-repo"
            v-model="issueRepo"
            class="input font-mono text-s"
            spellcheck="false"
            placeholder="sovrin/sonotas"
            :aria-invalid="!!fieldError('issueRepo') || undefined"
            aria-describedby="issue-repo-help"
          />
          <small id="issue-repo-help"
            >Optional. "Make an issue" opens a prefilled issue there, without the sender's
            email.</small
          >
          <span v-if="fieldError('issueRepo')" data-error>{{ fieldError('issueRepo') }}</span>
        </div>

        <div class="field">
          <label for="retention">Keep feedback for</label>
          <div class="cluster gap-3 flex-nowrap">
            <input
              id="retention"
              v-model.number="retentionDays"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="1"
              max="3650"
              style="inline-size: 6rem"
              aria-describedby="retention-help"
            />
            <span class="text-s text-muted">days</span>
          </div>
          <small id="retention-help">After its last change; then it is deleted, read or not.</small>
        </div>

        <div class="field">
          <label for="max-message">Longest message</label>
          <div class="cluster gap-3 flex-nowrap">
            <input
              id="max-message"
              v-model.number="maxMessage"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="1"
              :max="MAX_MESSAGE"
              style="inline-size: 6rem"
              :aria-invalid="!!fieldError('maxMessage') || undefined"
            />
            <span class="text-s text-muted">characters</span>
          </div>
          <span v-if="fieldError('maxMessage')" data-error>{{ fieldError('maxMessage') }}</span>
        </div>

        <div class="field">
          <label for="max-feedback">Hold at most</label>
          <div class="cluster gap-3 flex-nowrap">
            <input
              id="max-feedback"
              v-model.number="maxFeedback"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="1"
              max="100000"
              style="inline-size: 6rem"
              :aria-invalid="!!fieldError('maxFeedback') || undefined"
              aria-describedby="limits-help"
            />
            <span class="text-s text-muted">entries</span>
          </div>
        </div>

        <div class="field">
          <label for="max-storage">and at most</label>
          <div class="cluster gap-3 flex-nowrap">
            <input
              id="max-storage"
              v-model.number="maxStorageMb"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="1"
              max="10240"
              style="inline-size: 6rem"
              :aria-invalid="!!fieldError('maxStorageMb') || undefined"
              aria-describedby="limits-help"
            />
            <span class="text-s text-muted">MB of text</span>
          </div>
          <small id="limits-help"
            >When either is reached, the form turns feedback away until some is deleted or expires,
            so a flood cannot fill the disk.</small
          >
        </div>

        <label><input v-model="enabled" type="checkbox" /> Accept feedback</label>
      </div>
    </fieldset>

    <div v-if="issues.length || error" class="alert" data-tone="danger" role="alert">
      <div>
        <template v-if="error"><strong>Could not save the app.</strong> {{ error }}</template>
        <template v-else>
          <strong>Check these settings.</strong>
          <ul>
            <li v-for="issue in issues" :key="issue.path">
              <span class="font-mono">{{ issue.path }}</span
              >: {{ issue.message }}
            </li>
          </ul>
        </template>
      </div>
    </div>

    <div class="cluster gap-3 hairline-t pt-5">
      <p class="caption">
        {{
          enabled
            ? 'The form works on the project’s sites.'
            : 'Paused: the form says it is unavailable.'
        }}
      </p>
      <button
        type="submit"
        class="btn end"
        data-size="s"
        data-variant="primary"
        :disabled="pending"
        :aria-busy="pending || undefined"
      >
        Save changes
      </button>
    </div>
  </form>
</template>
