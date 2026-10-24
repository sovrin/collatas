<script setup lang="ts">
import type { AppConfig, AppSettings, ContextField } from '../../shared/contracts'
import { KIND_LABELS, KINDS, MAX_MESSAGE } from '../../shared/contracts'

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

const { pending, error, issues, fieldError, submit } = useSubmit()

function addField() {
  context.value.push({ key: '', max: 200 })
  moreOpen.value = true
}

async function save() {
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
  const saved = await submit(() =>
    $fetch<AppConfig>(`/api/p/${props.app.projectId}/feedback/form`, { method: 'POST', body }),
  )
  if (saved) emit('saved', saved)
  // A problem in a hidden setting opens them, so it can be seen.
  else if (issues.value.some((issue) => issue.path.split('.')[0] !== 'kinds')) moreOpen.value = true
}
</script>

<template>
  <form class="stack gap-5 measure" @submit.prevent="save">
    <fieldset :disabled="pending" class="stack gap-5">
      <!-- What every app needs comes first; the rest is behind More settings. -->
      <div class="field">
        <label id="kinds-label">Offers</label>
        <!-- aria-invalid on the group is what reveals the error of a server-side check. -->
        <div
          class="cluster gap-4"
          role="group"
          aria-labelledby="kinds-label"
          :aria-invalid="!!fieldError('kinds') || undefined"
        >
          <label v-for="kind in KINDS" :key="kind">
            <input v-model="kinds" type="checkbox" :value="kind" />
            {{ KIND_LABELS[kind] }}
          </label>
        </div>
        <span v-if="fieldError('kinds')" data-error>{{ fieldError('kinds') }}</span>
      </div>

      <details
        class="accordion"
        :open="moreOpen"
        @toggle="moreOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>More settings</summary>
        <div class="stack gap-5 pb-4">
          <fieldset class="stack gap-3">
            <legend class="text-s weight-600 pb-2">Context</legend>
            <small class="text-muted text-s"
              >What the app may send along, like its version or a settings code. People see it
              before they send.</small
            >
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
                class="input font-mono text-s w-auto"
                data-size="s"
                type="number"
                min="1"
                max="2000"
                :aria-label="`Context field ${index + 1}: longest value`"
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
            <span v-if="fieldError('context')" data-error>{{ fieldError('context') }}</span>
            <p>
              <button type="button" class="link text-s" @click="addField">
                Add a context field
              </button>
            </p>
          </fieldset>

          <div class="stack gap-1">
            <label><input v-model="sendPage" type="checkbox" /> Send the page address</label>
            <small class="text-muted text-s ps-5"
              >Each feedback can open the page it was sent from, with its query and state. Turn it
              off if the app's addresses hold private data.</small
            >
          </div>

          <div class="field">
            <label for="issue-repo">GitHub repository</label>
            <input
              id="issue-repo"
              v-model="issueRepo"
              class="input font-mono text-s"
              data-size="s"
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
                class="input font-mono text-s w-auto"
                data-size="s"
                type="number"
                min="1"
                max="3650"
                :aria-invalid="!!fieldError('retentionDays') || undefined"
                aria-describedby="retention-help"
              />
              <span class="text-s text-muted">days</span>
            </div>
            <small id="retention-help"
              >After its last change; then it is deleted, read or not.</small
            >
            <span v-if="fieldError('retentionDays')" data-error>{{
              fieldError('retentionDays')
            }}</span>
          </div>

          <div class="field">
            <label for="max-message">Longest message</label>
            <div class="cluster gap-3 flex-nowrap">
              <input
                id="max-message"
                v-model.number="maxMessage"
                class="input font-mono text-s w-auto"
                data-size="s"
                type="number"
                min="1"
                :max="MAX_MESSAGE"
                :aria-invalid="!!fieldError('maxMessage') || undefined"
              />
              <span class="text-s text-muted">characters</span>
            </div>
            <span v-if="fieldError('maxMessage')" data-error>{{ fieldError('maxMessage') }}</span>
          </div>

          <!-- The two limits are one rule, so they sit on one line under one explanation. -->
          <div class="stack gap-1">
            <div class="cluster gap-5 items-start">
              <div class="field">
                <label for="max-feedback">Hold at most</label>
                <div class="cluster gap-3 flex-nowrap">
                  <input
                    id="max-feedback"
                    v-model.number="maxFeedback"
                    class="input font-mono text-s w-auto"
                    data-size="s"
                    type="number"
                    min="1"
                    max="100000"
                    :aria-invalid="!!fieldError('maxFeedback') || undefined"
                    aria-describedby="limits-help"
                  />
                  <span class="text-s text-muted">entries</span>
                </div>
                <span v-if="fieldError('maxFeedback')" data-error>{{
                  fieldError('maxFeedback')
                }}</span>
              </div>

              <div class="field">
                <label for="max-storage">and at most</label>
                <div class="cluster gap-3 flex-nowrap">
                  <input
                    id="max-storage"
                    v-model.number="maxStorageMb"
                    class="input font-mono text-s w-auto"
                    data-size="s"
                    type="number"
                    min="1"
                    max="10240"
                    :aria-invalid="!!fieldError('maxStorageMb') || undefined"
                    aria-describedby="limits-help"
                  />
                  <span class="text-s text-muted">MB of text</span>
                </div>
                <span v-if="fieldError('maxStorageMb')" data-error>{{
                  fieldError('maxStorageMb')
                }}</span>
              </div>
            </div>
            <small id="limits-help" class="text-muted text-s"
              >When either is reached, the form turns feedback away until some is deleted or
              expires, so a flood cannot fill the disk.</small
            >
          </div>

          <label><input v-model="enabled" type="checkbox" /> Accept feedback</label>
        </div>
      </details>
    </fieldset>

    <FormIssues :error="error" :issues="issues" failed="Could not save the form." />

    <div class="cluster gap-3 hairline-t pt-5">
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
