<script setup lang="ts">
export interface TabItem {
  value: string
  label: string
  /** Optional count shown beside the label. */
  badge?: string | number | null
}

defineProps<{ tabs: TabItem[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="border-b border-hairline">
    <!-- Scrolls horizontally on a phone rather than wrapping into two rows. -->
    <div
      role="tablist"
      class="-mb-px flex gap-1 overflow-x-auto"
      style="scrollbar-width: none"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="tab.value === modelValue"
        class="flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm
               font-medium transition"
        :class="
          tab.value === modelValue
            ? 'border-primary-600 text-primary-700 dark:text-primary-300'
            : 'border-transparent text-content-muted hover:border-hairline hover:text-content'
        "
        @click="emit('update:modelValue', tab.value)"
      >
        {{ tab.label }}
        <span
          v-if="tab.badge !== null && tab.badge !== undefined"
          class="rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.6875rem] text-content-muted"
        >
          {{ tab.badge }}
        </span>
      </button>
    </div>
  </div>
</template>
