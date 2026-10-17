<script setup lang="ts">
import type { AppConfig, ContextField } from '#shared/contracts'
import { KIND_LABELS, KINDS } from '#shared/contracts'
import { errorMessage } from '~/lib/format'

/** Registers an app, or changes one. What the app's form offers and who may send it all lives
 *  here, so nothing about an app is configured in files. */
const props = defineProps<{ app?: AppConfig }>()
const emit = defineEmits<{ saved: [AppConfig] }>()

const name = ref(props.app?.name ?? '')
const id = ref(props.app?.id ?? '')
const idTouched = ref(!!props.app)
// A new app's id follows its name until it is edited by hand.
watch(name, (value) => {
  if (!idTouched.value)
    id.value = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
})
const origins = ref(props.app?.origins.join('\n') ?? '')
const kinds = ref<string[]>(props.app?.kinds ?? ['problem', 'idea'])
const context = ref<ContextField[]>(props.app?.context.map((field) => ({ ...field })) ?? [])
const setupUrl = ref(props.app?.setupUrl ?? '')
const issueRepo = ref(props.app?.issueRepo ?? '')
const retentionDays = ref(props.app?.retentionDays ?? 180)
const enabled = ref(props.app?.enabled ?? true)
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
  const body: AppConfig = {
    id: id.value,
    name: name.value,
    origins: origins.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    kinds: KINDS.filter((kind) => kinds.value.includes(kind)),
    context: context.value.map((field) => ({ key: field.key.trim(), max: Number(field.max) })),
    setupUrl: setupUrl.value,
    issueRepo: issueRepo.value,
    retentionDays: Number(retentionDays.value),
    enabled: enabled.value,
  }
  try {
    const saved = await $fetch<AppConfig>(props.app ? `/api/apps/${props.app.id}` : '/api/apps', {
      method: 'POST',
      body,
    })
    emit('saved', saved)
  } catch (cause) {
    const data = (cause as { data?: { data?: { issues?: typeof issues.value } } }).data?.data
    if (data?.issues?.length) {
      issues.value = data.issues
      // A problem in a hidden setting opens them, so it can be seen.
      if (
        issues.value.some(
          (issue) => !['name', 'id', 'origins', 'kinds'].includes(issue.path.split('.')[0]!),
        )
      )
        moreOpen.value = true
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
        <dt><label for="name">Name</label></dt>
        <dd class="field items-stretch">
          <input
            id="name"
            v-model="name"
            class="input"
            data-size="s"
            required
            maxlength="60"
            placeholder="sonotas"
            autocomplete="off"
            :aria-invalid="!!fieldError('name') || undefined"
          />
          <span v-if="fieldError('name')" data-error>{{ fieldError('name') }}</span>
        </dd>
        <dt><label for="id">Id</label></dt>
        <dd class="field items-stretch">
          <input
            id="id"
            v-model="id"
            class="input font-mono text-s"
            data-size="s"
            required
            maxlength="40"
            autocomplete="off"
            spellcheck="false"
            :readonly="!!app"
            :aria-invalid="!!fieldError('id') || undefined"
            aria-describedby="id-help"
            @input="idTouched = true"
          />
          <small id="id-help">{{
            app
              ? 'Fixed: the embedded form refers to it.'
              : 'Used by the embedded form. It cannot change later.'
          }}</small>
          <span v-if="fieldError('id')" data-error>{{ fieldError('id') }}</span>
        </dd>
        <dt><label for="origins">Sites</label></dt>
        <dd class="field items-stretch">
          <textarea
            id="origins"
            v-model="origins"
            class="input font-mono text-s"
            required
            spellcheck="false"
            placeholder="https://sonotas.sovrin.de"
            :aria-invalid="!!fieldError('origins') || undefined"
            aria-describedby="origins-help"
          ></textarea>
          <small id="origins-help">One per line. Only these may show the form and send.</small>
          <span v-if="fieldError('origins')" data-error>{{ fieldError('origins') }}</span>
        </dd>
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
        <span class="text-muted"> context, links, retention, pausing</span>
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
            <button type="button" class="link text-s" data-quiet @click="context.splice(index, 1)">
              Remove
            </button>
          </div>
          <span v-if="fieldError('context')" class="text-s text-danger">{{
            fieldError('context')
          }}</span>
          <p>
            <button type="button" class="link text-s" @click="addField">Add a context field</button>
          </p>
        </div>

        <div class="field">
          <label for="setup-url">Setup address</label>
          <input
            id="setup-url"
            v-model="setupUrl"
            class="input font-mono text-s"
            spellcheck="false"
            placeholder="https://sonotas.sovrin.de/?s={settings}"
            :aria-invalid="!!fieldError('setupUrl') || undefined"
            aria-describedby="setup-url-help"
          />
          <small id="setup-url-help"
            >Optional. "Open setup" on a feedback leads here; {name} takes that context
            value.</small
          >
          <span v-if="fieldError('setupUrl')" data-error>{{ fieldError('setupUrl') }}</span>
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
          <label for="retention">Keep done and spam for</label>
          <div class="cluster gap-3 flex-nowrap">
            <input
              id="retention"
              v-model.number="retentionDays"
              class="input font-mono text-s"
              data-size="s"
              type="number"
              min="0"
              max="3650"
              style="inline-size: 6rem"
              aria-describedby="retention-help"
            />
            <span class="text-s text-muted">days</span>
          </div>
          <small id="retention-help">Then they are deleted. 0 keeps them.</small>
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
            ? 'The form works on the sites above.'
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
        {{ app ? 'Save changes' : 'Add app' }}
      </button>
    </div>
  </form>
</template>
