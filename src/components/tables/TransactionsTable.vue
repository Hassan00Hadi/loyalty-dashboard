<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Smartphone } from 'lucide-vue-next'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from './BaseTable.vue'
import { listUserTransactions } from '@/api/wallets.api'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { POINT_TRANSACTION_TYPES, type PointTransactionType } from '@/types/models'

/**
 * A member's point transactions, server-paged and filterable by type.
 *
 * Shared by the wallet detail page and the standalone transactions page, so the
 * columns and the earned/spent treatment stay identical in both.
 */
const props = defineProps<{ userId: string }>()

const { t } = useI18n()
const fmt = useFormat()

const typeFilter = ref<PointTransactionType | null>(null)

const transactions = usePagedResource(
  (query) => listUserTransactions(props.userId, { ...query, type: typeFilter.value }),
  {
    errorTitleKey: 'errors.loadTransactionsFailed',
    watchSources: () => [props.userId, typeFilter.value],
  },
)

const typeOptions = computed<SelectOption[]>(() =>
  POINT_TRANSACTION_TYPES.map((type) => ({
    value: type,
    label: t(`transactions.types.${type}`),
  })),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'createdAt', label: t('transactions.date') },
  { key: 'type', label: t('transactions.type') },
  { key: 'amount', label: t('transactions.amount'), align: 'end' },
  { key: 'source', label: t('transactions.source'), hideBelow: 'md' },
  { key: 'reference', label: t('transactions.reference'), hideBelow: 'lg', mono: true },
])

/** Spending reduces a balance, so it is shown with an explicit minus sign. */
function signedAmount(type: PointTransactionType, amount: number): string {
  const formatted = fmt.points(amount)
  if (type === 'Spent') return `−${formatted}`
  if (type === 'Earned') return `+${formatted}`
  return formatted
}

function amountClass(type: PointTransactionType): string {
  if (type === 'Earned') return 'text-success-700 dark:text-success-500'
  if (type === 'Spent') return 'text-primary-700 dark:text-primary-300'
  return 'text-content'
}
</script>

<template>
  <div>
    <ListToolbar :has-filters="typeFilter !== null" @clear="typeFilter = null">
      <template #filters>
        <div class="w-full sm:w-44">
          <BaseSelect
            v-model="typeFilter"
            :options="typeOptions"
            :placeholder="$t('transactions.allTypes')"
          />
        </div>
      </template>
    </ListToolbar>

    <BaseTable
      :columns="columns"
      :rows="transactions.items.value"
      row-key="id"
      :loading="transactions.loading.value"
      :refreshing="transactions.refreshing.value"
      :error="transactions.error.value"
      :empty-title="$t('transactions.empty')"
      :empty-body="$t('transactions.emptyHint')"
      @retry="transactions.refresh()"
    >
      <template #cell:createdAt="{ row }">
        <span class="whitespace-nowrap">{{ fmt.dateTime(row.createdAt) }}</span>
      </template>

      <template #cell:type="{ row }">
        <StatusBadge :transaction="row.type" />
      </template>

      <template #cell:amount="{ row }">
        <span class="font-semibold tabular-nums" :class="amountClass(row.type)">
          {{ signedAmount(row.type, row.amount) }}
        </span>
      </template>

      <template #cell:source="{ row }">
        <div class="min-w-0">
          <!--
            A spending-based award carries its calculation snapshot, so the row
            can explain its own arithmetic even after the configuration changes.
          -->
          <p v-if="row.amountSpent !== null" class="truncate text-xs text-content-muted">
            {{
              $t('transactions.calculationDetail', {
                points: fmt.number(row.pointsPerAmount),
                threshold: fmt.number(row.amountIqd),
                amount: fmt.currency(row.amountSpent),
              })
            }}
          </p>
          <p v-else-if="row.packageName" class="truncate text-xs text-content-muted">
            {{ row.packageName }}
          </p>

          <!--
            Shown alongside the calculation rather than instead of it: the backend
            uses it for what the arithmetic cannot say, such as a purchase that
            failed and was not charged.
          -->
          <p
            v-if="row.description"
            class="line-clamp-2 max-w-xs text-xs text-content"
            :title="row.description"
          >
            {{ row.description }}
          </p>

          <span
            v-if="row.amountSpent === null && !row.packageName && !row.description"
            class="text-xs text-content-subtle"
          >—</span>

          <span
            v-if="row.isMobileApp"
            class="mt-0.5 inline-flex items-center gap-1 text-[0.6875rem] text-content-subtle"
          >
            <Smartphone class="size-3" aria-hidden="true" />
            {{ $t('transactions.mobileApp') }}
          </span>
        </div>
      </template>

      <template #cell:reference="{ row }">
        <span
          class="block max-w-[12rem] truncate text-content-muted"
          :title="row.externalSubscriptionId ?? row.referenceId ?? undefined"
          dir="ltr"
        >
          {{ row.externalSubscriptionId ?? row.referenceId ?? '—' }}
        </span>
      </template>
    </BaseTable>

    <BasePagination
      :page="transactions.page.value"
      :page-size="transactions.pageSize.value"
      :total-count="transactions.totalCount.value"
      :total-pages="transactions.totalPages.value"
      :has-next-page="transactions.hasNextPage.value"
      :has-previous-page="transactions.hasPreviousPage.value"
      :range-from="transactions.rangeFrom.value"
      :range-to="transactions.rangeTo.value"
      :disabled="transactions.refreshing.value"
      @update:page="transactions.goToPage"
      @update:page-size="transactions.setPageSize"
    />
  </div>
</template>
