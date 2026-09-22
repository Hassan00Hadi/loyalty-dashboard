<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    /** Square button for a lone icon; pass an accessible label too. */
    iconOnly?: boolean
    label?: string
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
    iconOnly: false,
  },
)

// A loading button stays disabled: this is what stops a double submit on the
// subscription form and on every other mutating action.
const isDisabled = computed(() => props.disabled || props.loading)

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 ' +
    'disabled:bg-primary-600/50 shadow-sm',
  accent:
    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 ' +
    'disabled:bg-accent-500/50 shadow-sm',
  secondary:
    'bg-surface text-content border border-hairline hover:bg-surface-muted ' +
    'active:bg-surface-muted disabled:text-content-subtle shadow-sm',
  ghost: 'bg-transparent text-content-muted hover:bg-surface-muted hover:text-content',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 ' +
    'disabled:bg-danger-600/50 shadow-sm',
}

const sizeClasses = computed<Record<Size, string>>(() => ({
  sm: props.iconOnly ? 'h-8 w-8' : 'h-8 px-3 text-xs gap-1.5',
  md: props.iconOnly ? 'h-9 w-9' : 'h-9 px-3.5 text-sm gap-2',
  lg: props.iconOnly ? 'h-11 w-11' : 'h-11 px-5 text-sm gap-2',
}))
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    :aria-label="iconOnly ? label : undefined"
    :title="iconOnly ? label : undefined"
    class="inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition
           disabled:cursor-not-allowed"
    :class="[variantClasses[variant], sizeClasses[size], block ? 'w-full' : '']"
  >
    <Loader2 v-if="loading" class="size-4 shrink-0 animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <span v-if="!iconOnly" :class="loading && !$slots.default ? 'sr-only' : ''">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>
