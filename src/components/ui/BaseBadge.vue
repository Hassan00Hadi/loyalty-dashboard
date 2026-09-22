<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'accent'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    /**
     * Adds a filled dot before the label. Status is then carried by shape and
     * text as well as colour, which colour-blind users need.
     */
    dot?: boolean
    size?: 'sm' | 'md'
  }>(),
  { variant: 'neutral', dot: false, size: 'md' },
)

const classes: Record<Variant, string> = {
  neutral: 'bg-surface-muted text-content-muted ring-hairline',
  success: 'bg-success-50 text-success-700 ring-success-500/25 dark:bg-success-500/10 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-700 ring-warning-500/25 dark:bg-warning-500/10 dark:text-warning-500',
  danger: 'bg-danger-50 text-danger-700 ring-danger-500/25 dark:bg-danger-500/10 dark:text-danger-500',
  info: 'bg-info-50 text-info-700 ring-info-500/25 dark:bg-info-500/10 dark:text-info-500',
  primary: 'bg-primary-50 text-primary-700 ring-primary-500/25 dark:bg-primary-500/15 dark:text-primary-300',
  accent: 'bg-accent-50 text-accent-700 ring-accent-500/25 dark:bg-accent-500/10 dark:text-accent-400',
}

const dotColour: Record<Variant, string> = {
  neutral: 'bg-content-subtle',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  primary: 'bg-primary-500',
  accent: 'bg-accent-500',
}

const sizeClass = computed(() =>
  props.size === 'sm' ? 'px-1.5 py-0.5 text-[0.6875rem]' : 'px-2 py-0.5 text-xs',
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset"
    :class="[classes[variant], sizeClass]"
  >
    <span v-if="dot" class="size-1.5 shrink-0 rounded-full" :class="dotColour[variant]" aria-hidden="true" />
    <slot />
  </span>
</template>
