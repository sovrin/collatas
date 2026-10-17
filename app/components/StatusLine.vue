<script setup lang="ts">
// The inbox's heartbeat on every signed-in page: is anything waiting to be read?
const { data, refresh } = useFetch<{ newCount: number; appCount: number }>('/api/summary', {
  key: 'status-line',
  server: false,
  lazy: true,
})
usePolling(refresh)
// Refresh on navigation too, so the line never contradicts the page that just loaded.
const route = useRoute()
watch(
  () => route.fullPath,
  () => refresh(),
)
</script>
<template>
  <!-- One small mono line under the page. It truncates rather than wraps. -->
  <p class="cluster gap-2 flex-nowrap font-mono text-xs text-muted" aria-label="Inbox status">
    <span class="dot" :data-tone="data?.newCount ? 'warning' : undefined" aria-hidden="true"></span>
    <span class="flex-1 min-w-0 truncate" role="status">
      <template v-if="data">
        <NuxtLink to="/" class="link" data-quiet>{{
          data.newCount ? `${data.newCount} new` : 'nothing new'
        }}</NuxtLink>
        ·
        <NuxtLink to="/apps" class="link" data-quiet
          >{{ data.appCount }} {{ data.appCount === 1 ? 'app' : 'apps' }}</NuxtLink
        >
      </template>
      <template v-else>inbox loading</template>
    </span>
  </p>
</template>
