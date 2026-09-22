<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean
    danger?: boolean
    disabled?: boolean
  }>(),
  { active: false, danger: false, disabled: false },
)
</script>

<template>
  <button
    type="button"
    role="menuitem"
    :disabled="disabled"
    class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition
           disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      danger
        ? 'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10'
        : active
          ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
          : 'text-content hover:bg-surface-muted',
    ]"
  >
    <slot name="icon" />
    <span class="min-w-0 flex-1 truncate"><slot /></span>
    <slot name="trailing" />
  </button>
</template>
