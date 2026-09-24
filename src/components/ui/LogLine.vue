<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from './BaseBadge.vue'
import CopyButton from './CopyButton.vue'
import { useFormat } from '@/composables/useFormat'
import {
  extraFields,
  fieldText,
  levelVariant,
  shortSource,
  statusVariant,
  type ParsedLogLine,
} from '@/utils/logLines'

/**
 * One log line: a one-row summary that expands into every structured field.
 *
 * A line from the requests file reads as a table row — method, path, status,
 * duration, user — since that is what the file is for; any other line reads as
 * time, level, source and message. A line that is not JSON is shown as it is.
 */
const props = defineProps<{
  line: ParsedLogLine
  /** Lay out as a request row. Ignored for a line without the request fields. */
  requestLayout?: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
  /** Show every line logged for this request. */
  trace: [traceId: string, timestamp: string]
}>()

const fmt = useFormat()

const entry = computed(() => (props.line.kind === 'entry' ? props.line.entry : null))

const isRequestRow = computed(
  () => props.requestLayout && typeof entry.value?.RequestPath === 'string',
)

const fields = computed(() => (entry.value ? extraFields(entry.value) : []))
</script>

<template>
  <div class="border-b border-hairline text-xs last:border-b-0">
    <p v-if="!entry" class="whitespace-pre-wrap break-all px-3 py-1.5 font-mono text-content-muted">
      {{ line.raw }}
    </p>

    <template v-else>
      <button
        type="button"
        class="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5 text-start
               transition hover:bg-surface-muted"
        :class="expanded ? 'bg-surface-muted' : ''"
        :aria-expanded="expanded"
        @click="emit('toggle')"
      >
        <span class="w-24 shrink-0 font-mono tabular-nums text-content-muted">
          {{ fmt.preciseTime(entry.timestamp) }}
        </span>

        <template v-if="isRequestRow">
          <span class="w-14 shrink-0 font-mono font-semibold">{{ entry.RequestMethod }}</span>
          <span class="min-w-0 flex-1 basis-48 break-all font-mono">{{ entry.RequestPath }}</span>
          <span class="w-12 shrink-0">
            <BaseBadge :variant="statusVariant(entry.StatusCode)" size="sm">
              {{ entry.StatusCode ?? '—' }}
            </BaseBadge>
          </span>
          <span class="w-20 shrink-0 text-end tabular-nums text-content-muted">
            {{ entry.Elapsed === undefined ? '—' : `${fmt.number(entry.Elapsed, { maximumFractionDigits: 1 })} ms` }}
          </span>
          <span class="hidden w-28 shrink-0 truncate text-content-muted md:inline" :title="entry.UserId">
            {{ entry.UserId ?? '—' }}
          </span>
        </template>

        <template v-else>
          <span class="w-20 shrink-0">
            <BaseBadge :variant="levelVariant(entry.level)" size="sm">{{ entry.level }}</BaseBadge>
          </span>
          <span
            class="hidden w-40 shrink-0 truncate text-content-muted sm:inline"
            :title="entry.category"
          >
            {{ shortSource(entry.category) }}
          </span>
          <span class="min-w-0 flex-1 basis-64 whitespace-pre-wrap break-words text-content">
            {{ entry.message }}
          </span>
        </template>
      </button>

      <div v-if="expanded" class="space-y-3 bg-surface-muted px-3 pb-3 pt-1">
        <p v-if="isRequestRow" class="whitespace-pre-wrap break-words text-content">{{ entry.message }}</p>

        <dl class="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt class="truncate text-content-muted">{{ $t('logs.source') }}</dt>
          <dd class="break-all font-mono">{{ entry.category }}</dd>

          <template v-for="[key, value] in fields" :key="key">
            <dt class="truncate text-content-muted" :title="key">{{ key }}</dt>
            <dd v-if="key === 'TraceId' && typeof value === 'string'" class="flex items-center gap-1">
              <button
                type="button"
                class="break-all font-mono text-primary-700 underline-offset-2 hover:underline
                       dark:text-primary-300"
                :title="$t('logs.showTrace')"
                @click="emit('trace', value, entry.timestamp)"
              >
                {{ value }}
              </button>
              <CopyButton :value="value" :label="$t('errors.copyTraceId')" />
            </dd>
            <dd v-else class="whitespace-pre-wrap break-all font-mono">{{ fieldText(value) }}</dd>
          </template>
        </dl>

        <div v-if="entry.exception" class="space-y-1">
          <p class="font-semibold text-danger-700 dark:text-danger-500">{{ $t('logs.exception') }}</p>
          <p class="break-all font-mono">{{ entry.exception.type }}</p>
          <p class="whitespace-pre-wrap break-words">{{ entry.exception.message }}</p>
          <p v-if="entry.exception.inner" class="break-words text-content-muted">
            {{ $t('logs.innerException') }}:
            <span class="font-mono">{{ entry.exception.inner.type }}</span> —
            {{ entry.exception.inner.message }}
          </p>
          <pre
            v-if="entry.exception.stackTrace"
            class="max-h-64 overflow-auto rounded-md bg-surface p-2 font-mono text-[0.6875rem] leading-4
                   ring-1 ring-inset ring-hairline"
          >{{ entry.exception.stackTrace }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>
