<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Download, RefreshCw, Search } from 'lucide-vue-next'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'
import BaseModal from './BaseModal.vue'
import BaseSelect, { type SelectOption } from './BaseSelect.vue'
import BaseToggle from './BaseToggle.vue'
import LogLine from './LogLine.vue'
import { readLogFile, readRequestTrace } from '@/api/logs.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useFormat } from '@/composables/useFormat'
import { levelRank, logDay, MIN_RANK, parseLogLine, type LevelFilter } from '@/utils/logLines'
import type { LogContent, LogFile } from '@/types/models'

/**
 * The tail of one log file, read in the page rather than downloaded.
 *
 * Only the last few thousand lines are ever fetched; the full file is a download.
 * Each line is a JSON object and is shown as a row that expands into its fields.
 * Auto-refresh polls the same read, which is how today's file is followed while it
 * is still being written.
 *
 * Clicking a TraceId switches to that request's lines from the application log,
 * where everything logged while handling it lives; "Back" returns to the file.
 */
const props = defineProps<{
  open: boolean
  file: LogFile | null
  /** The parent owns downloads, so its row spinner and this one stay in step. */
  downloading?: boolean
}>()

const emit = defineEmits<{
  close: []
  download: [file: LogFile]
  /** The file is gone — deleted by retention since the list was loaded. */
  missing: [file: LogFile]
}>()

const { t } = useI18n()
const fmt = useFormat()
const { messageFor } = useApiError()

const AUTO_REFRESH_MS = 5_000
const TAIL_OPTIONS = [200, 1000, 5000]

const search = ref('')
const debouncedSearch = useDebouncedRef(search, 300)
const tail = ref(TAIL_OPTIONS[0])
const autoRefresh = ref(false)
const levelFilter = ref<LevelFilter>('all')

/** Set while showing one request's lines instead of the file. */
const trace = ref<{ id: string; day: string } | null>(null)

const tailOptions = computed<SelectOption[]>(() =>
  TAIL_OPTIONS.map((count) => ({ value: count, label: t('logs.lastLines', { count: fmt.number(count) }) })),
)

const levelOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('logs.levels.all') },
  { value: 'warning', label: t('logs.levels.warning') },
  { value: 'error', label: t('logs.levels.error') },
])

const content = useAsyncResource(
  () =>
    trace.value
      ? readRequestTrace(trace.value.id, trace.value.day)
      : readLogFile(props.file!, {
          tail: tail.value,
          search: debouncedSearch.value.trim() || null,
        }),
  { immediate: false, toastOnError: false },
)

// ── Lines ─────────────────────────────────────────────────────────────────────

const parsed = computed(() => content.data.value?.lines.map(parseLogLine) ?? [])

// Filtered here rather than on the server: the read endpoint has no level parameter.
// A line that is not JSON has no level, so it shows only under "all".
const visible = computed(() => {
  if (levelFilter.value === 'all') return parsed.value
  const min = MIN_RANK[levelFilter.value]
  return parsed.value.filter(
    (line) => line.kind === 'entry' && levelRank(line.entry.level) >= min,
  )
})

const requestLayout = computed(() => !trace.value && props.file?.category === 'requests')

// Keyed by the line's text, not its position: a poll slides the tail window, and an
// index would then open a different line.
const expanded = ref(new Set<string>())

function toggle(raw: string): void {
  if (expanded.value.has(raw)) expanded.value.delete(raw)
  else expanded.value.add(raw)
}

// ── Scrolling ─────────────────────────────────────────────────────────────────
// Newest lines are last, so the viewer opens at the bottom and follows new lines —
// unless the reader has scrolled up to look at something, which a poll must not undo.

const viewport = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)

function onScroll(): void {
  const el = viewport.value
  if (!el) return
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24
}

watch(content.data, async () => {
  if (!stickToBottom.value) return
  await nextTick()
  if (viewport.value) viewport.value.scrollTop = viewport.value.scrollHeight
})

// ── Loading ───────────────────────────────────────────────────────────────────

/** A different set of lines, so nothing carries over from the last one. */
function reload(): void {
  stickToBottom.value = true
  expanded.value.clear()
  void content.execute({ silent: false })
}

// Cleared on close rather than on open, so the first read of the next file already
// sees an empty search — the debounced copy is reset too, since it would otherwise
// still hold the old term for another 300 ms. No previous file's lines are shown
// under the next file's name.
watch(
  () => props.open,
  (open) => {
    if (open) {
      if (props.file) reload()
      return
    }
    search.value = ''
    debouncedSearch.value = ''
    autoRefresh.value = false
    levelFilter.value = 'all'
    trace.value = null
    content.data.value = null
    expanded.value.clear()
  },
)

watch([tail, debouncedSearch], () => {
  if (props.open && props.file && !trace.value) reload()
})

function showTrace(id: string, timestamp: string): void {
  const day = logDay(timestamp)
  if (!day) return
  autoRefresh.value = false
  trace.value = { id, day }
  reload()
}

function leaveTrace(): void {
  trace.value = null
  reload()
}

// Only the file itself going missing closes the viewer; a trace lookup reads
// other files, and its failure is shown inline instead.
watch(content.error, (error) => {
  if (error?.status === 404 && props.file && !trace.value) emit('missing', props.file)
})

let timer: ReturnType<typeof setInterval> | undefined

function stopPolling(): void {
  clearInterval(timer)
  timer = undefined
}

watch(
  () => props.open && autoRefresh.value,
  (polling) => {
    stopPolling()
    if (!polling) return
    timer = setInterval(() => {
      // A slow read is left to finish rather than overtaken by the next tick.
      if (!content.loading.value && !content.refreshing.value) void content.refresh()
    }, AUTO_REFRESH_MS)
  },
)

onScopeDispose(stopPolling)

// ── Summary ───────────────────────────────────────────────────────────────────

/** Size and time from the latest read, since today's file grows while it is open. */
const fileInfo = computed<Pick<LogFile, 'sizeBytes' | 'lastModifiedUtc'> | null>(() => {
  const data = content.data.value
  return !trace.value && data && 'sizeBytes' in data ? (data as LogContent) : props.file
})

const summary = computed(() => {
  const data = content.data.value
  if (!data) return ''
  const shown = fmt.number(data.lines.length)
  const total = fmt.number(data.totalMatchedLines)
  const base = data.truncated
    ? t('logs.truncated', { shown, total })
    : t('logs.lineCount', { count: total })
  return levelFilter.value === 'all'
    ? base
    : `${base} · ${t('logs.filteredCount', { count: fmt.number(visible.value.length) })}`
})

const emptyMessage = computed(() => {
  if (trace.value) return t('logs.traceEmpty')
  if (parsed.value.length > 0) return t('logs.noLevelMatches')
  return debouncedSearch.value.trim() ? t('logs.noMatches') : t('logs.fileEmpty')
})
</script>

<template>
  <BaseModal :open="open" size="xl" :title="file?.fileName" @close="emit('close')">
    <template v-if="file" #header>
      <h2 class="truncate font-mono text-sm font-semibold text-content" dir="ltr">{{ file.fileName }}</h2>
      <p v-if="fileInfo" class="mt-1 text-xs text-content-muted">
        {{ fmt.bytes(fileInfo.sizeBytes) }} · {{ fmt.dateTime(fileInfo.lastModifiedUtc) }}
      </p>
    </template>

    <div class="space-y-3">
      <div v-if="trace" class="flex flex-wrap items-center gap-3">
        <BaseButton variant="secondary" size="sm" @click="leaveTrace">
          <template #icon><ArrowLeft class="size-4 rtl:rotate-180" /></template>
          {{ $t('logs.backToFile') }}
        </BaseButton>
        <p class="min-w-0 flex-1 text-xs text-content-muted">
          {{ $t('logs.traceBanner') }}
          <span class="break-all font-mono text-content" dir="ltr">{{ trace.id }}</span>
        </p>
      </div>

      <div v-else class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <BaseInput
            v-model="search"
            type="search"
            :placeholder="$t('logs.searchPlaceholder')"
            class="[&_input]:ps-9"
          />
          <Search
            class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-content-subtle"
            aria-hidden="true"
          />
        </div>
        <div class="w-full sm:w-40">
          <BaseSelect
            :model-value="tail"
            :options="tailOptions"
            @update:model-value="(value) => (tail = Number(value) || TAIL_OPTIONS[0])"
          />
        </div>
        <BaseButton
          variant="secondary"
          :loading="content.refreshing.value"
          :disabled="content.loading.value"
          @click="content.refresh()"
        >
          <template #icon><RefreshCw class="size-4" /></template>
          {{ $t('common.refresh') }}
        </BaseButton>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="w-full sm:w-48">
            <BaseSelect
              :model-value="levelFilter"
              :options="levelOptions"
              @update:model-value="(value) => (levelFilter = (value as LevelFilter) ?? 'all')"
            />
          </div>
          <BaseToggle v-if="!trace" v-model="autoRefresh" :label="$t('logs.autoRefresh')" />
        </div>
        <p class="text-xs text-content-muted" aria-live="polite">{{ summary }}</p>
      </div>

      <BaseAlert v-if="content.error.value" variant="error">
        {{ messageFor(content.error.value) }}
      </BaseAlert>

      <div
        ref="viewport"
        class="h-[55vh] overflow-y-auto rounded-lg bg-surface ring-1 ring-inset ring-hairline"
        dir="ltr"
        @scroll.passive="onScroll"
      >
        <p v-if="content.loading.value" class="p-4 text-sm text-content-muted">
          {{ $t('common.loading') }}
        </p>
        <p v-else-if="content.data.value && visible.length === 0" class="p-4 text-sm text-content-muted">
          {{ emptyMessage }}
        </p>
        <template v-else-if="content.data.value">
          <!-- Column headings for the requests table; the rows use the same widths. -->
          <div
            v-if="requestLayout"
            class="sticky top-0 z-10 hidden gap-x-3 border-b border-hairline bg-surface px-3 py-1.5
                   text-[0.6875rem] font-medium uppercase tracking-wide text-content-subtle sm:flex"
          >
            <span class="w-24 shrink-0">{{ $t('logs.columns.time') }}</span>
            <span class="w-14 shrink-0">{{ $t('logs.columns.method') }}</span>
            <span class="min-w-0 flex-1">{{ $t('logs.columns.path') }}</span>
            <span class="w-12 shrink-0">{{ $t('logs.columns.status') }}</span>
            <span class="w-20 shrink-0 text-end">{{ $t('logs.columns.duration') }}</span>
            <span class="hidden w-28 shrink-0 md:inline">{{ $t('logs.columns.user') }}</span>
          </div>

          <LogLine
            v-for="(line, index) in visible"
            :key="`${index}:${line.raw}`"
            :line="line"
            :request-layout="requestLayout"
            :expanded="expanded.has(line.raw)"
            @toggle="toggle(line.raw)"
            @trace="showTrace"
          />
        </template>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
      <BaseButton
        v-if="file"
        variant="primary"
        :loading="downloading"
        @click="emit('download', file)"
      >
        <template #icon><Download class="size-4" /></template>
        {{ $t('logs.downloadFull') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
