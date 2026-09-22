<script setup lang="ts">
import { Search, SlidersHorizontal, X } from 'lucide-vue-next'
import { ref } from 'vue'
import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{
    search?: string
    searchPlaceholder?: string
    /** True when any filter is set, which reveals the clear action. */
    hasFilters?: boolean
    resultCount?: number | null
  }>(),
  { hasFilters: false, resultCount: null },
)

const emit = defineEmits<{
  'update:search': [value: string]
  clear: []
}>()

/** On a phone the filter row is collapsed behind a toggle to save height. */
const filtersOpen = ref(false)
</script>

<template>
  <div class="border-b border-hairline px-4 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <div v-if="search !== undefined" class="relative min-w-56 flex-1">
        <Search
          class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-content-subtle"
          aria-hidden="true"
        />
        <input
          :value="search"
          type="search"
          :placeholder="searchPlaceholder ?? $t('common.searchPlaceholder')"
          :aria-label="searchPlaceholder ?? $t('common.search')"
          class="field-base ps-9"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <BaseButton
        v-if="$slots.filters"
        variant="secondary"
        size="md"
        class="sm:hidden"
        icon-only
        :label="$t('common.filters')"
        @click="filtersOpen = !filtersOpen"
      >
        <template #icon><SlidersHorizontal class="size-4" /></template>
      </BaseButton>

      <!-- Filters sit inline from `sm` up. -->
      <div v-if="$slots.filters" class="hidden min-w-0 flex-wrap items-center gap-2 sm:flex">
        <slot name="filters" />
      </div>

      <BaseButton
        v-if="hasFilters"
        variant="ghost"
        size="md"
        icon-only
        :label="$t('common.clearFilters')"
        @click="emit('clear')"
      >
        <template #icon><X class="size-4" /></template>
      </BaseButton>

      <div v-if="$slots.actions" class="ms-auto flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <!-- Collapsed filter panel, phones only. -->
    <div v-if="$slots.filters && filtersOpen" class="mt-3 grid gap-2 sm:hidden">
      <slot name="filters" />
    </div>

    <p v-if="resultCount !== null" class="mt-2 text-xs text-content-subtle">
      {{ $t('table.showingCount', { count: resultCount }) }}
    </p>
  </div>
</template>
