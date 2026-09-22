<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <h1 class="truncate text-xl font-semibold tracking-tight text-content sm:text-2xl">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="mt-1 text-sm text-content-muted">{{ subtitle }}</p>
    </div>

    <!-- Actions wrap under the title on narrow screens rather than squeezing it. -->
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
