<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import BaseSkeleton from './BaseSkeleton.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | null
    hint?: string
    icon?: LucideIcon
    loading?: boolean
    accent?: 'primary' | 'accent' | 'success' | 'info'
    to?: string
  }>(),
  { loading: false, accent: 'primary' },
)

const accents = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-500',
} as const
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    :to="to"
    class="card-base block px-4 py-4 transition"
    :class="to ? 'hover:border-primary-300 hover:shadow-raised' : ''"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-medium text-content-muted">{{ label }}</p>

        <BaseSkeleton v-if="loading" height="h-7" width="w-20" class="mt-2" />
        <p v-else class="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-content">
          {{ value ?? '—' }}
        </p>

        <p v-if="hint && !loading" class="mt-1 truncate text-xs text-content-subtle">{{ hint }}</p>
      </div>

      <div
        v-if="icon"
        class="flex size-9 shrink-0 items-center justify-center rounded-xl"
        :class="accents[accent]"
        aria-hidden="true"
      >
        <component :is="icon" class="size-[1.125rem]" />
      </div>
    </div>
  </component>
</template>
