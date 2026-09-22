<script setup lang="ts">
import { computed } from 'vue'
import { useFormat } from '@/composables/useFormat'

export interface ChartDatum {
  label: string
  value: number
}

/**
 * A horizontal bar chart drawn with plain elements.
 *
 * Deliberately not a canvas chart: for a handful of labelled totals, DOM bars
 * inherit the theme tokens, mirror correctly in RTL, stay readable to a screen
 * reader, and cost nothing to render. Chart.js is reserved for anything that
 * genuinely needs axes.
 */
const props = withDefaults(
  defineProps<{
    data: ChartDatum[]
    /** Caps the number of bars; the rest are dropped from the view. */
    limit?: number
    accent?: 'primary' | 'accent'
  }>(),
  { limit: 6, accent: 'primary' },
)

const fmt = useFormat()

const rows = computed(() =>
  [...props.data].sort((a, b) => b.value - a.value).slice(0, props.limit),
)

const max = computed(() => Math.max(1, ...rows.value.map((row) => row.value)))

const barColour = computed(() =>
  props.accent === 'accent' ? 'bg-accent-500' : 'bg-primary-600',
)
</script>

<template>
  <div v-if="rows.length" class="space-y-2.5">
    <div v-for="row in rows" :key="row.label">
      <div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span class="min-w-0 truncate text-content-muted">{{ row.label }}</span>
        <span class="shrink-0 font-semibold tabular-nums text-content">
          {{ fmt.number(row.value) }}
        </span>
      </div>
      <!--
        A meter is the right role here: it announces the value and its range,
        so the chart is not colour-only information.
      -->
      <div
        class="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        :aria-valuenow="row.value"
        :aria-valuemin="0"
        :aria-valuemax="max"
        :aria-label="row.label"
      >
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="barColour"
          :style="{ width: `${Math.max(2, (row.value / max) * 100)}%` }"
        />
      </div>
    </div>
  </div>

  <p v-else class="py-6 text-center text-sm text-content-muted">
    {{ $t('dashboard.charts.noChartData') }}
  </p>
</template>
