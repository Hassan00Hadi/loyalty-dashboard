<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Eye, RefreshCw } from 'lucide-vue-next'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import LogViewerModal from '@/components/ui/LogViewerModal.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { downloadLogFile, listLogFiles } from '@/api/logs.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { useToastStore } from '@/stores/toast.store'
import { saveBlob } from '@/utils/download'
import type { LogCategory, LogFile } from '@/types/models'

/**
 * The server's log files: listed, viewed in the page, and downloaded.
 *
 * Today's files are still being written, so the list is refreshed on demand rather
 * than assumed current; a view or download gets whatever was logged up to that moment.
 * Retention can delete a listed file at any time, so a 404 from either reloads the list.
 */
const { t } = useI18n()
const fmt = useFormat()
const { report } = useApiError()
const toast = useToastStore()

type CategoryTab = 'all' | LogCategory

const activeTab = ref<CategoryTab>('all')

const tabs = computed<TabItem[]>(() => [
  { value: 'all', label: t('common.all') },
  { value: 'application', label: t('logs.categories.application') },
  { value: 'errors', label: t('logs.categories.errors') },
  { value: 'requests', label: t('logs.categories.requests') },
])

const files = useAsyncResource(
  () => listLogFiles(activeTab.value === 'all' ? null : activeTab.value),
  { errorTitleKey: 'errors.loadLogsFailed' },
)

watch(activeTab, () => files.refresh())

const columns = computed<TableColumn[]>(() => [
  { key: 'fileName', label: t('logs.fileName') },
  { key: 'category', label: t('logs.category'), hideBelow: 'sm' },
  { key: 'sizeBytes', label: t('logs.size'), align: 'end' },
  { key: 'lastModifiedUtc', label: t('logs.lastModified'), hideBelow: 'md' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const categoryVariant: Record<LogCategory, 'neutral' | 'danger' | 'info'> = {
  application: 'neutral',
  errors: 'danger',
  requests: 'info',
}

const fileKey = (file: LogFile): string => `${file.category}/${file.fileName}`

// ── Download ──────────────────────────────────────────────────────────────────
// Tracked per file so several can run at once, each with its own spinner.

const downloading = ref(new Set<string>())

async function download(file: LogFile): Promise<void> {
  const key = fileKey(file)
  if (downloading.value.has(key)) return

  downloading.value.add(key)
  try {
    saveBlob(await downloadLogFile(file), file.fileName)
  } catch (error) {
    const normalised = report(error, t('logs.downloadFailed'))
    // Retention deleted it since the list was loaded.
    if (normalised.status === 404) {
      viewing.value = null
      await files.refresh()
    }
  } finally {
    downloading.value.delete(key)
  }
}

// ── View ──────────────────────────────────────────────────────────────────────

const viewing = ref<LogFile | null>(null)

async function onMissing(): Promise<void> {
  viewing.value = null
  toast.error(t('logs.fileGone'))
  await files.refresh()
}
</script>

<template>
  <div>
    <PageHeader :title="$t('logs.title')" :subtitle="$t('logs.subtitle')">
      <template #actions>
        <BaseButton
          variant="secondary"
          :loading="files.refreshing.value"
          :disabled="files.loading.value"
          @click="files.refresh()"
        >
          <template #icon><RefreshCw class="size-4" /></template>
          {{ $t('common.refresh') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <template #header>
        <BaseTabs v-model="activeTab" :tabs="tabs" class="-mx-4 -my-3.5 border-b-0 sm:-mx-5" />
      </template>

      <BaseTable
        :columns="columns"
        :rows="files.data.value ?? []"
        :row-key="fileKey"
        :loading="files.loading.value"
        :refreshing="files.refreshing.value"
        :error="files.error.value"
        :empty-title="$t('logs.empty')"
        :empty-body="$t('logs.emptyHint')"
        @retry="files.refresh()"
      >
        <template #cell:fileName="{ row }">
          <span class="font-mono text-xs">{{ row.fileName }}</span>
        </template>

        <template #cell:category="{ row }">
          <BaseBadge :variant="categoryVariant[row.category] ?? 'neutral'" size="sm">
            {{ $te(`logs.categories.${row.category}`) ? $t(`logs.categories.${row.category}`) : row.category }}
          </BaseBadge>
        </template>

        <template #cell:sizeBytes="{ row }">
          <span class="tabular-nums">{{ fmt.bytes(row.sizeBytes) }}</span>
        </template>

        <template #cell:lastModifiedUtc="{ row }">
          <span class="text-content-muted">{{ fmt.dateTime(row.lastModifiedUtc) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="viewing = row">
              <template #icon><Eye class="size-4" /></template>
              {{ $t('logs.view') }}
            </BaseButton>
            <BaseButton
              variant="secondary"
              size="sm"
              :loading="downloading.has(fileKey(row))"
              @click="download(row)"
            >
              <template #icon><Download class="size-4" /></template>
              {{ $t('logs.download') }}
            </BaseButton>
          </div>
        </template>
      </BaseTable>
    </BaseCard>

    <LogViewerModal
      :open="viewing !== null"
      :file="viewing"
      :downloading="viewing !== null && downloading.has(fileKey(viewing))"
      @close="viewing = null"
      @download="download"
      @missing="onMissing"
    />
  </div>
</template>
