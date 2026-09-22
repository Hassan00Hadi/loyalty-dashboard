<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BadgeCheck,
  Ban,
  CalendarX,
  Coins,
  Repeat2,
  Ticket,
  TicketCheck,
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseErrorState from '@/components/ui/BaseErrorState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { getBranchPerformance, getVoucherStatistics } from '@/api/adminVouchers.api'
import { listMerchants, listOffers } from '@/api/catalog.api'
import { listBranches } from '@/api/branches.api'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { P } from '@/utils/permissions'
import type { StatisticsQuery } from '@/types/models'

/**
 * Activation and redemption figures.
 *
 * Every number comes from a database aggregate over the whole filtered set — the
 * dashboard does no counting of its own, so these describe the system rather than
 * whatever rows a page happened to fetch.
 */
const { t } = useI18n()
const fmt = useFormat()
const { can } = usePermissions()

const merchantFilter = ref<string | null>(null)
const branchFilter = ref<string | null>(null)
const offerFilter = ref<string | null>(null)
const dateFrom = ref('')
const dateTo = ref('')

const query = computed<StatisticsQuery>(() => ({
  merchantId: merchantFilter.value,
  branchId: branchFilter.value,
  offerId: offerFilter.value,
  dateFrom: dateFrom.value ? new Date(dateFrom.value).toISOString() : null,
  dateTo: dateTo.value ? new Date(dateTo.value).toISOString() : null,
}))

const stats = useAsyncResource(() => getVoucherStatistics(query.value), {
  errorTitleKey: 'errors.loadFailed',
  toastOnError: false,
})

const performance = useAsyncResource(() => getBranchPerformance(query.value), {
  errorTitleKey: 'errors.loadFailed',
  toastOnError: false,
})

// Both reload together so the cards and the table always describe the same filter.
watch(query, () => {
  void stats.refresh()
  void performance.refresh()
})

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

const columns = computed<TableColumn[]>(() => [
  { key: 'branchName', label: t('statistics.branch') },
  { key: 'merchantName', label: t('statistics.merchant'), hideBelow: 'md' },
  { key: 'cityName', label: t('statistics.city'), hideBelow: 'lg' },
  { key: 'activatedOffers', label: t('statistics.activatedOffers'), align: 'end' },
  { key: 'activeVouchers', label: t('statistics.activeVouchers'), align: 'end', hideBelow: 'sm' },
  { key: 'usedVouchers', label: t('statistics.usedVouchers'), align: 'end' },
  { key: 'expiredVouchers', label: t('statistics.expiredVouchers'), align: 'end', hideBelow: 'xl' },
  { key: 'pointsSpent', label: t('statistics.pointsSpent'), align: 'end' },
])
</script>

<template>
  <div>
    <PageHeader :title="$t('statistics.title')" :subtitle="$t('statistics.subtitle')" />

    <!-- Filters -->
    <BaseCard class="mb-5" :title="$t('statistics.filters')">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BaseSelect
          v-if="merchantOptions.length"
          v-model="merchantFilter"
          :options="merchantOptions"
          :label="$t('statistics.merchant')"
          :placeholder="$t('vouchers.allMerchants')"
        />
        <BaseSelect
          v-if="branchOptions.length"
          v-model="branchFilter"
          :options="branchOptions"
          :label="$t('statistics.branch')"
          :placeholder="$t('vouchers.allBranches')"
        />
        <BaseSelect
          v-if="offerOptions.length"
          v-model="offerFilter"
          :options="offerOptions"
          :label="$t('vouchers.offer')"
          :placeholder="$t('vouchers.allOffers')"
        />
        <BaseInput v-model="dateFrom" type="date" :label="$t('statistics.dateFrom')" dir="ltr" />
        <BaseInput v-model="dateTo" type="date" :label="$t('statistics.dateTo')" dir="ltr" />
      </div>
    </BaseCard>

    <!-- Totals -->
    <BaseCard v-if="stats.error.value" flush class="mb-5">
      <BaseErrorState :error="stats.error.value" compact @retry="stats.refresh()" />
    </BaseCard>

    <div v-else class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        :label="$t('statistics.activatedOffers')"
        :value="fmt.number(stats.data.value?.activatedOffers)"
        :icon="Ticket"
        :loading="stats.loading.value"
        accent="primary"
      />
      <KpiCard
        :label="$t('statistics.activeVouchers')"
        :value="fmt.number(stats.data.value?.activeVouchers)"
        :icon="BadgeCheck"
        :loading="stats.loading.value"
        accent="success"
      />
      <KpiCard
        :label="$t('statistics.usedVouchers')"
        :value="fmt.number(stats.data.value?.usedVouchers)"
        :icon="TicketCheck"
        :loading="stats.loading.value"
        accent="info"
      />
      <KpiCard
        :label="$t('statistics.totalPointsSpent')"
        :value="fmt.points(stats.data.value?.totalPointsSpent)"
        :icon="Coins"
        :loading="stats.loading.value"
        accent="accent"
      />
      <KpiCard
        :label="$t('statistics.expiredVouchers')"
        :value="fmt.number(stats.data.value?.expiredVouchers)"
        :icon="CalendarX"
        :loading="stats.loading.value"
        accent="primary"
      />
      <KpiCard
        :label="$t('statistics.cancelledVouchers')"
        :value="fmt.number(stats.data.value?.cancelledVouchers)"
        :icon="Ban"
        :loading="stats.loading.value"
        accent="primary"
      />
      <KpiCard
        :label="$t('statistics.totalRedemptions')"
        :value="fmt.number(stats.data.value?.totalRedemptions)"
        :icon="Repeat2"
        :loading="stats.loading.value"
        accent="info"
      />
    </div>

    <!-- Per-branch breakdown -->
    <BaseCard
      flush
      :title="$t('statistics.branchPerformance')"
      :subtitle="$t('statistics.branchPerformanceHint')"
    >
      <div v-if="performance.loading.value" class="space-y-3 p-4">
        <BaseSkeleton v-for="row in 4" :key="row" height="h-9" rounded="rounded-lg" />
      </div>

      <BaseErrorState
        v-else-if="performance.error.value"
        :error="performance.error.value"
        compact
        @retry="performance.refresh()"
      />

      <BaseEmptyState
        v-else-if="(performance.data.value?.length ?? 0) === 0"
        :title="$t('statistics.emptyBranches')"
        :body="$t('statistics.emptyBranchesHint')"
        compact
      />

      <BaseTable
        v-else
        :columns="columns"
        :rows="performance.data.value ?? []"
        row-key="branchId"
        :refreshing="performance.refreshing.value"
      >
        <template #cell:branchName="{ row }">
          <span class="font-medium">{{ row.branchName || '—' }}</span>
        </template>
        <template #cell:merchantName="{ row }">
          <span class="text-content-muted">{{ row.merchantName ?? '—' }}</span>
        </template>
        <template #cell:cityName="{ row }">
          <span class="text-content-muted">{{ row.cityName ?? '—' }}</span>
        </template>
        <template #cell:activatedOffers="{ row }">
          <span class="font-semibold tabular-nums">{{ fmt.number(row.activatedOffers) }}</span>
        </template>
        <template #cell:activeVouchers="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.activeVouchers) }}</span>
        </template>
        <template #cell:usedVouchers="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.usedVouchers) }}</span>
        </template>
        <template #cell:expiredVouchers="{ row }">
          <span class="tabular-nums text-content-muted">{{ fmt.number(row.expiredVouchers) }}</span>
        </template>
        <template #cell:pointsSpent="{ row }">
          <span class="font-semibold tabular-nums">{{ fmt.points(row.pointsSpent) }}</span>
        </template>
      </BaseTable>
    </BaseCard>
  </div>
</template>
