<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { QrCode } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import CopyButton from '@/components/ui/CopyButton.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from './BaseTable.vue'
import VoucherDetailModal from '@/components/ui/VoucherDetailModal.vue'
import { listUserVouchers } from '@/api/wallets.api'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { VOUCHER_STATUSES, type Voucher, type VoucherStatus } from '@/types/models'

/**
 * A member's vouchers, server-paged and filterable by status.
 *
 * Each row opens the voucher detail, which renders the QR from the API's own
 * `qrCodeData` — no voucher data is ever synthesised here.
 */
const props = defineProps<{ userId: string }>()

const { t } = useI18n()
const fmt = useFormat()

const statusFilter = ref<VoucherStatus | null>(null)
const selected = ref<Voucher | null>(null)

const vouchers = usePagedResource(
  (query) => listUserVouchers(props.userId, { ...query, status: statusFilter.value }),
  {
    errorTitleKey: 'errors.loadVouchersFailed',
    watchSources: () => [props.userId, statusFilter.value],
  },
)

const statusOptions = computed<SelectOption[]>(() =>
  VOUCHER_STATUSES.map((status) => ({
    value: status,
    label: t(`vouchers.statuses.${status}`),
  })),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'voucherCode', label: t('vouchers.voucherCode'), mono: true },
  { key: 'offerTitle', label: t('vouchers.offer') },
  { key: 'merchantName', label: t('vouchers.merchant'), hideBelow: 'lg' },
  { key: 'discountPercentage', label: t('vouchers.discount'), align: 'end', hideBelow: 'sm' },
  { key: 'status', label: t('common.status') },
  { key: 'expiresAt', label: t('vouchers.expiresAt'), hideBelow: 'md' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])
</script>

<template>
  <div>
    <ListToolbar :has-filters="statusFilter !== null" @clear="statusFilter = null">
      <template #filters>
        <div class="w-full sm:w-44">
          <BaseSelect
            v-model="statusFilter"
            :options="statusOptions"
            :placeholder="$t('vouchers.allStatuses')"
          />
        </div>
      </template>
    </ListToolbar>

    <BaseTable
      :columns="columns"
      :rows="vouchers.items.value"
      row-key="id"
      :loading="vouchers.loading.value"
      :refreshing="vouchers.refreshing.value"
      :error="vouchers.error.value"
      :empty-title="$t('vouchers.empty')"
      :empty-body="$t('vouchers.emptyHint')"
      @retry="vouchers.refresh()"
    >
      <template #cell:voucherCode="{ row }">
        <div class="flex items-center gap-1.5">
          <span class="truncate" :title="row.voucherCode" dir="ltr">{{ row.voucherCode }}</span>
          <CopyButton :value="row.voucherCode" />
        </div>
      </template>

      <template #cell:offerTitle="{ row }">
        <span class="truncate font-medium">{{ row.offerTitle }}</span>
      </template>

      <template #cell:merchantName="{ row }">
        <span class="text-content-muted">{{ row.merchantName ?? '—' }}</span>
      </template>

      <template #cell:discountPercentage="{ row }">
        <span class="tabular-nums">{{ fmt.discount(row.discountType, row.discountValue) }}</span>
      </template>

      <template #cell:status="{ row }">
        <StatusBadge :voucher="row.status" />
      </template>

      <template #cell:expiresAt="{ row }">
        <span class="whitespace-nowrap text-content-muted">{{ fmt.date(row.expiresAt) }}</span>
      </template>

      <template #cell:actions="{ row }">
        <BaseButton variant="secondary" size="sm" @click="selected = row">
          <template #icon><QrCode class="size-3.5" /></template>
          {{ $t('vouchers.qrCode') }}
        </BaseButton>
      </template>
    </BaseTable>

    <BasePagination
      :page="vouchers.page.value"
      :page-size="vouchers.pageSize.value"
      :total-count="vouchers.totalCount.value"
      :total-pages="vouchers.totalPages.value"
      :has-next-page="vouchers.hasNextPage.value"
      :has-previous-page="vouchers.hasPreviousPage.value"
      :range-from="vouchers.rangeFrom.value"
      :range-to="vouchers.rangeTo.value"
      :disabled="vouchers.refreshing.value"
      @update:page="vouchers.goToPage"
      @update:page-size="vouchers.setPageSize"
    />

    <VoucherDetailModal :voucher="selected" @close="selected = null" />
  </div>
</template>
