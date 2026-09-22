<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import { useFormat } from '@/composables/useFormat'
import { useUiStore } from '@/stores/ui.store'

const props = defineProps<{
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  rangeFrom: number
  rangeTo: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const ui = useUiStore()
const fmt = useFormat()

const pageSizes = [10, 20, 50, 100]

/**
 * The arrows are chosen by writing direction, not hard-coded: in RTL,
 * "previous" points right. Swapping the glyph — rather than mirroring the icon
 * with a transform — keeps it visually correct at every size.
 */
const PrevIcon = computed(() => (ui.isRtl ? ChevronRight : ChevronLeft))
const NextIcon = computed(() => (ui.isRtl ? ChevronLeft : ChevronRight))
const FirstIcon = computed(() => (ui.isRtl ? ChevronsRight : ChevronsLeft))
const LastIcon = computed(() => (ui.isRtl ? ChevronsLeft : ChevronsRight))

/**
 * A compact window of page numbers around the current page, with the first and
 * last always reachable. Ellipses are rendered as inert text.
 */
const pageItems = computed<(number | 'gap')[]>(() => {
  const total = props.totalPages
  const current = props.page
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const items: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push('gap')
  for (let candidate = start; candidate <= end; candidate += 1) items.push(candidate)
  if (end < total - 1) items.push('gap')
  items.push(total)

  return items
})

const buttonBase =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium ' +
  'transition disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <nav
    v-if="totalCount > 0"
    class="flex flex-col gap-3 border-t border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    :aria-label="$t('table.page')"
  >
    <div class="flex items-center gap-3 text-xs text-content-muted">
      <span>
        {{
          $t('table.showing', {
            from: fmt.number(rangeFrom),
            to: fmt.number(rangeTo),
            total: fmt.number(totalCount),
          })
        }}
      </span>

      <label class="hidden items-center gap-1.5 sm:flex">
        <span class="sr-only">{{ $t('table.rowsPerPage') }}</span>
        <select
          :value="pageSize"
          :disabled="disabled"
          class="h-7 rounded-md border border-hairline bg-surface px-1.5 text-xs text-content"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        :class="buttonBase"
        class="text-content-muted hover:bg-surface-muted hover:text-content"
        :disabled="!hasPreviousPage || disabled"
        :aria-label="$t('table.first')"
        @click="emit('update:page', 1)"
      >
        <component :is="FirstIcon" class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="buttonBase"
        class="text-content-muted hover:bg-surface-muted hover:text-content"
        :disabled="!hasPreviousPage || disabled"
        :aria-label="$t('table.previous')"
        @click="emit('update:page', page - 1)"
      >
        <component :is="PrevIcon" class="size-4" aria-hidden="true" />
      </button>

      <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
        <span v-if="item === 'gap'" class="px-1 text-xs text-content-subtle" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          :class="[
            buttonBase,
            item === page
              ? 'bg-primary-600 text-white'
              : 'text-content-muted hover:bg-surface-muted hover:text-content',
          ]"
          :disabled="disabled"
          :aria-current="item === page ? 'page' : undefined"
          @click="emit('update:page', item)"
        >
          {{ fmt.number(item) }}
        </button>
      </template>

      <button
        type="button"
        :class="buttonBase"
        class="text-content-muted hover:bg-surface-muted hover:text-content"
        :disabled="!hasNextPage || disabled"
        :aria-label="$t('table.next')"
        @click="emit('update:page', page + 1)"
      >
        <component :is="NextIcon" class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="buttonBase"
        class="text-content-muted hover:bg-surface-muted hover:text-content"
        :disabled="!hasNextPage || disabled"
        :aria-label="$t('table.last')"
        @click="emit('update:page', totalPages)"
      >
        <component :is="LastIcon" class="size-4" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>
