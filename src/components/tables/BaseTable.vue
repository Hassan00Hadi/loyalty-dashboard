<script setup lang="ts" generic="T">
import { computed } from 'vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseErrorState from '@/components/ui/BaseErrorState.vue'
import type { NormalisedError } from '@/types/api'

export interface TableColumn {
  key: string
  label: string
  /** Tailwind alignment for the cell; defaults to start. */
  align?: 'start' | 'end' | 'center'
  /** Hides the column below the given breakpoint, e.g. `md`. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  width?: string
  /** Renders in a monospace face, for ids and codes. */
  mono?: boolean
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: T[]
    rowKey: keyof T | ((row: T) => string)
    loading?: boolean
    refreshing?: boolean
    error?: NormalisedError | null
    emptyTitle?: string
    emptyBody?: string
    /** Number of skeleton rows shown during the first load. */
    skeletonRows?: number
  }>(),
  { loading: false, refreshing: false, error: null, skeletonRows: 6 },
)

const emit = defineEmits<{ retry: [] }>()

function keyOf(row: T, index: number): string {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  const value = (row as Record<string, unknown>)[props.rowKey as string]
  return value === null || value === undefined ? String(index) : String(value)
}

/**
 * Fallback for a column with no `cell:` slot.
 *
 * Reading the property needs a cast because `T` is unconstrained — which is
 * deliberate, so that a page's own row type survives into the slots rather than
 * being widened to an index-signature type.
 */
function cellValue(row: T, key: string): string {
  const value = (row as Record<string, unknown>)[key]
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

const alignClass = (align: TableColumn['align']) =>
  align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start'

const hideClass = (hideBelow: TableColumn['hideBelow']) => {
  switch (hideBelow) {
    case 'sm':
      return 'hidden sm:table-cell'
    case 'md':
      return 'hidden md:table-cell'
    case 'lg':
      return 'hidden lg:table-cell'
    case 'xl':
      return 'hidden xl:table-cell'
    default:
      return ''
  }
}

const showTable = computed(() => !props.loading && !props.error && props.rows.length > 0)
</script>

<template>
  <div class="relative">
    <!-- A refresh dims the current rows rather than replacing them with skeletons. -->
    <div
      v-if="refreshing"
      class="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary-100 dark:bg-primary-500/20"
      role="status"
      :aria-label="$t('a11y.loading')"
    >
      <div class="h-full w-1/3 animate-pulse bg-primary-600" />
    </div>

    <BaseErrorState v-if="error" :error="error" compact @retry="emit('retry')" />

    <!-- First load: a skeleton shaped like the real table. -->
    <div v-else-if="loading" class="px-4 py-4">
      <div class="space-y-3">
        <BaseSkeleton v-for="row in skeletonRows" :key="row" height="h-9" rounded="rounded-lg" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="rows.length === 0"
      :title="emptyTitle ?? $t('states.emptyTitle')"
      :body="emptyBody ?? $t('states.emptyBody')"
      compact
    >
      <template v-if="$slots['empty-action']" #action>
        <slot name="empty-action" />
      </template>
    </BaseEmptyState>

    <!--
      The horizontal scroller is the table's own wrapper, so a wide table scrolls
      inside the card instead of forcing the page to scroll sideways.
    -->
    <div v-if="showTable" class="overflow-x-auto" :class="refreshing ? 'opacity-60 transition' : ''">
      <!--
        `min-w-full` rather than `w-full`: a table with many columns must grow past the
        card and scroll inside this wrapper. With `w-full` the browser compresses it to
        fit instead, which silently clipped the last column's row actions.
      -->
      <table class="min-w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-hairline bg-surface-muted">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-content-muted"
              :class="[alignClass(column.align), hideClass(column.hideBelow)]"
              :style="column.width ? { width: column.width } : undefined"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-hairline">
          <tr
            v-for="(row, index) in rows"
            :key="keyOf(row, index)"
            class="transition hover:bg-surface-muted/60"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 align-middle text-content"
              :class="[
                alignClass(column.align),
                hideClass(column.hideBelow),
                column.mono ? 'font-mono text-xs' : '',
                // The actions column holds buttons that must not wrap or be clipped;
                // it claims its full width and the table scrolls instead.
                column.key === 'actions' ? 'whitespace-nowrap' : '',
              ]"
            >
              <slot :name="`cell:${column.key}`" :row="row" :index="index">
                {{ cellValue(row, column.key) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <slot name="footer" />
  </div>
</template>
