<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { QrCode, XCircle } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import CopyButton from '@/components/ui/CopyButton.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import AdminVoucherModal from '@/components/ui/AdminVoucherModal.vue'
import { cancelVoucher, listAdminVouchers } from '@/api/adminVouchers.api'
import { listMerchants, listOffers } from '@/api/catalog.api'
import { listBranches } from '@/api/branches.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import { VOUCHER_STATUSES, type AdminVoucher, type VoucherStatus } from '@/types/models'

/**
 * Every issued voucher, across merchants.
 *
 * Each row shows the snapshot the voucher was issued under — its branch, points and
 * discount — which is what stays fixed when a branch rule is edited afterwards.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor } = useApiError()

const search = ref('')
const merchantFilter = ref<string | null>(null)
const branchFilter = ref<string | null>(null)
const offerFilter = ref<string | null>(null)
const statusFilter = ref<VoucherStatus | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const selected = ref<AdminVoucher | null>(null)

const vouchers = usePagedResource(
  (query) =>
    listAdminVouchers({
      ...query,
      search: search.value.trim() || null,
      merchantId: merchantFilter.value,
      branchId: branchFilter.value,
      offerId: offerFilter.value,
      status: statusFilter.value,
      dateFrom: dateFrom.value ? new Date(dateFrom.value).toISOString() : null,
      dateTo: dateTo.value ? new Date(dateTo.value).toISOString() : null,
    }),
  {
    errorTitleKey: 'errors.loadVouchersFailed',
    watchSources: () => [
      search.value,
      merchantFilter.value,
      branchFilter.value,
      offerFilter.value,
      statusFilter.value,
      dateFrom.value,
      dateTo.value,
    ],
  },
)

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null
const branches = can(P.BranchesRead)
  ? useAsyncResource(() => listBranches(), { toastOnError: false })
  : null
const offers = can(P.OffersRead)
  ? useAsyncResource(() => listOffers(), { toastOnError: false })
  : null

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((m) => ({ value: m.id, label: m.name })) ?? [],
)
const branchOptions = computed<SelectOption[]>(
  () => branches?.data.value?.map((b) => ({ value: b.id, label: b.name })) ?? [],
)
const offerOptions = computed<SelectOption[]>(
  () => offers?.data.value?.map((o) => ({ value: o.id, label: o.title })) ?? [],
)
const statusOptions = computed<SelectOption[]>(() =>
  VOUCHER_STATUSES.map((status) => ({ value: status, label: t(`vouchers.statuses.${status}`) })),
)

const hasFilters = computed(
  () =>
    search.value.length > 0 ||
    merchantFilter.value !== null ||
    branchFilter.value !== null ||
    offerFilter.value !== null ||
    statusFilter.value !== null ||
    dateFrom.value !== '' ||
    dateTo.value !== '',
)

function clearFilters(): void {
  search.value = ''
  merchantFilter.value = null
  branchFilter.value = null
  offerFilter.value = null
  statusFilter.value = null
  dateFrom.value = ''
  dateTo.value = ''
}

const columns = computed<TableColumn[]>(() => [
  { key: 'voucherCode', label: t('vouchers.voucherCode'), mono: true },
  { key: 'offerTitle', label: t('vouchers.offer') },
  { key: 'branchName', label: t('vouchers.branch'), hideBelow: 'md' },
  { key: 'discount', label: t('vouchers.discount'), align: 'end', hideBelow: 'sm' },
  { key: 'pointsSpent', label: t('vouchers.pointsSpent'), align: 'end', hideBelow: 'lg' },
  { key: 'status', label: t('common.status') },
  { key: 'expiresAt', label: t('vouchers.expiresAt'), hideBelow: 'xl' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

/** Renders a voucher's discount by its own snapshotted type. */
function discountLabel(voucher: AdminVoucher): string {
  return voucher.discountType === 'Percentage'
    ? fmt.percent(voucher.discountValue)
    : fmt.currency(voucher.discountValue)
}

async function cancel(voucher: AdminVoucher): Promise<void> {
  const confirmed = await confirm({
    title: t('vouchers.cancelConfirmTitle'),
    body: t('vouchers.cancelConfirmBody'),
    confirmLabel: t('vouchers.cancel'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await cancelVoucher(voucher.id)
    toast.success(t('vouchers.cancelled'), t('vouchers.cancelNoRefundNote'))
    await vouchers.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('vouchers.allVouchers')" :subtitle="$t('vouchers.allVouchersSubtitle')" />

    <BaseAlert variant="info" class="mb-4">{{ $t('vouchers.snapshotNote') }}</BaseAlert>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :search-placeholder="$t('vouchers.searchPlaceholder')"
        :has-filters="hasFilters"
        @clear="clearFilters"
      >
        <template #filters>
          <div v-if="merchantOptions.length" class="w-full sm:w-40">
            <BaseSelect
              v-model="merchantFilter"
              :options="merchantOptions"
              :placeholder="$t('vouchers.allMerchants')"
            />
          </div>
          <div v-if="branchOptions.length" class="w-full sm:w-40">
            <BaseSelect
              v-model="branchFilter"
              :options="branchOptions"
              :placeholder="$t('vouchers.allBranches')"
            />
          </div>
          <div v-if="offerOptions.length" class="w-full sm:w-40">
            <BaseSelect
              v-model="offerFilter"
              :options="offerOptions"
              :placeholder="$t('vouchers.allOffers')"
            />
          </div>
          <div class="w-full sm:w-36">
            <BaseSelect
              v-model="statusFilter"
              :options="statusOptions"
              :placeholder="$t('vouchers.allStatuses')"
            />
          </div>
          <div class="w-full sm:w-40">
            <BaseInput v-model="dateFrom" type="date" :placeholder="$t('vouchers.dateFrom')" dir="ltr" />
          </div>
          <div class="w-full sm:w-40">
            <BaseInput v-model="dateTo" type="date" :placeholder="$t('vouchers.dateTo')" dir="ltr" />
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
        :empty-title="$t('vouchers.emptyAll')"
        :empty-body="$t('vouchers.emptyAllHint')"
        @retry="vouchers.refresh()"
      >
        <template #cell:voucherCode="{ row }">
          <div class="flex items-center gap-1.5">
            <span class="truncate" :title="row.voucherCode" dir="ltr">{{ row.voucherCode }}</span>
            <CopyButton :value="row.voucherCode" />
          </div>
        </template>

        <template #cell:offerTitle="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.offerTitle ?? '—' }}</p>
            <p v-if="row.merchantName" class="truncate text-xs text-content-muted">
              {{ row.merchantName }}
            </p>
          </div>
        </template>

        <template #cell:branchName="{ row }">
          <div class="min-w-0">
            <span v-if="row.branchName" class="truncate text-content-muted">{{ row.branchName }}</span>
            <span v-else class="text-xs text-content-subtle">{{ $t('vouchers.noBranch') }}</span>
            <p v-if="row.cityName" class="truncate text-xs text-content-subtle">{{ row.cityName }}</p>
          </div>
        </template>

        <template #cell:discount="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <span class="tabular-nums">{{ discountLabel(row) }}</span>
            <BaseBadge v-if="row.discountType === 'FixedAmount'" size="sm" variant="accent">
              {{ $t('discountTypes.FixedAmount') }}
            </BaseBadge>
          </div>
        </template>

        <template #cell:pointsSpent="{ row }">
          <span class="tabular-nums">{{ fmt.points(row.pointsSpent) }}</span>
        </template>

        <template #cell:status="{ row }">
          <StatusBadge :voucher="row.status" />
        </template>

        <template #cell:expiresAt="{ row }">
          <span class="whitespace-nowrap text-content-muted">{{ fmt.dateTime(row.expiresAt) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton variant="secondary" size="sm" @click="selected = row">
              <template #icon><QrCode class="size-3.5" /></template>
              {{ $t('common.view') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.VouchersCancel) && row.status === 'Active'"
              variant="ghost"
              size="sm"
              class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
              @click="cancel(row)"
            >
              <template #icon><XCircle class="size-3.5" /></template>
              {{ $t('common.cancel') }}
            </BaseButton>
          </div>
        </template>
      </BaseTable>

      <template #footer>
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
          class="-mx-4 -mb-3 border-t-0"
          @update:page="vouchers.goToPage"
          @update:page-size="vouchers.setPageSize"
        />
      </template>
    </BaseCard>

    <AdminVoucherModal
      :voucher="selected"
      @close="selected = null"
      @cancelled="
        () => {
          selected = null
          vouchers.refresh()
        }
      "
    />
  </div>
</template>
