<script setup lang="ts">
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-vue-next'

type Variant = 'success' | 'error' | 'warning' | 'info'

withDefaults(defineProps<{ variant?: Variant; title?: string }>(), { variant: 'info' })

const styles: Record<Variant, { wrapper: string; icon: string }> = {
  success: {
    wrapper:
      'bg-success-50 text-success-700 ring-success-500/20 dark:bg-success-500/10 dark:text-success-500',
    icon: 'text-success-600 dark:text-success-500',
  },
  error: {
    wrapper:
      'bg-danger-50 text-danger-700 ring-danger-500/20 dark:bg-danger-500/10 dark:text-danger-500',
    icon: 'text-danger-600 dark:text-danger-500',
  },
  warning: {
    wrapper:
      'bg-warning-50 text-warning-800 ring-warning-500/25 dark:bg-warning-500/10 dark:text-warning-500',
    icon: 'text-warning-600 dark:text-warning-500',
  },
  info: {
    wrapper: 'bg-info-50 text-info-700 ring-info-500/20 dark:bg-info-500/10 dark:text-info-500',
    icon: 'text-info-600 dark:text-info-500',
  },
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
} as const
</script>

<template>
  <div
    class="flex gap-3 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset"
    :class="styles[variant].wrapper"
    :role="variant === 'error' || variant === 'warning' ? 'alert' : 'status'"
  >
    <component
      :is="icons[variant]"
      class="mt-0.5 size-4 shrink-0"
      :class="styles[variant].icon"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1 leading-relaxed">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <div :class="title ? 'mt-0.5' : ''"><slot /></div>
    </div>
    <div v-if="$slots.action" class="shrink-0 self-center">
      <slot name="action" />
    </div>
  </div>
</template>
