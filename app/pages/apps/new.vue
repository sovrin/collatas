<script setup lang="ts">
import type { AppConfig } from '#shared/contracts'
useHead({ title: 'Add an app · collatas' })
const saved = (app: AppConfig) => navigateTo(`/apps/${app.id}`)
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/apps">Apps</NuxtLink></li>
        <li aria-current="page">Add</li>
      </ol>
    </nav>
    <h1 class="text-l weight-600 mb-5">Add an app</h1>
    <AppForm @saved="saved" />
  </div>
</template>
