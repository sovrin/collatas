<script setup lang="ts">
import type { AppSummary } from '#shared/contracts'
import { errorMessage } from '~/lib/format'
useHead({ title: 'Apps · collatas' })
const { data, error, refresh } = await useFetch<AppSummary[]>('/api/apps')
useLive(refresh)
</script>

<template>
  <div class="stack gap-5">
    <h1 class="sr-only">Apps</h1>
    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load your apps.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="data">
      <ul v-if="data.length" data-variant="plain" aria-label="Apps">
        <li v-for="app in data" :key="app.id" class="py-3 hairline-b">
          <div class="cluster gap-3 flex-nowrap">
            <span
              class="dot"
              :data-tone="app.enabled ? 'success' : undefined"
              aria-hidden="true"
            ></span>
            <NuxtLink
              :to="`/apps/${app.id}`"
              class="link font-mono flex-1 min-w-0 break-words"
              data-quiet
              >{{ app.id }}</NuxtLink
            >
            <!-- Colour only where the owner is needed: unread feedback. -->
            <NuxtLink v-if="app.newCount" :to="`/?app=${app.id}`" class="link text-warning"
              >{{ app.newCount }} new</NuxtLink
            >
            <span v-else class="text-muted">{{ app.enabled ? 'accepting' : 'paused' }}</span>
          </div>
          <p class="ps-4 font-mono text-xs text-muted break-words">
            {{ app.origins.join(' · ') }}
          </p>
        </li>
      </ul>
      <p v-else class="text-muted">No apps yet. Add one to get a form you can embed in it.</p>
      <p><NuxtLink to="/apps/new" class="link">Add an app</NuxtLink></p>
    </template>
  </div>
</template>
