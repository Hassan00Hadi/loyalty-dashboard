<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
import BrandLogo from '@/components/layout/BrandLogo.vue'

withDefaults(
  defineProps<{
    title: string
    body?: string
    /** Shows the brand mark instead of a generic glyph, for first-run states. */
    branded?: boolean
    compact?: boolean
  }>(),
  { branded: false, compact: false },
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-6 text-center"
    :class="compact ? 'py-10' : 'py-16'"
  >
    <div
      v-if="branded"
      class="mb-4 flex items-center justify-center rounded-2xl bg-surface-muted px-5 py-4 opacity-60"
    >
      <BrandLogo :height="24" />
    </div>
    <div
      v-else
      class="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-muted"
      aria-hidden="true"
    >
      <slot name="icon">
        <Inbox class="size-6 text-content-subtle" />
      </slot>
    </div>

    <h3 class="text-sm font-semibold text-content">{{ title }}</h3>
    <p v-if="body" class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-content-muted">
      {{ body }}
    </p>

    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
