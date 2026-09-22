<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CreditCard,
  FolderTree,
  Gauge,
  MapPin,
  Medal,
  ScanLine,
  Store,
  Tags,
  Wallet,
} from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import BarChart, { type ChartDatum } from '@/components/charts/BarChart.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { listWallets } from '@/api/wallets.api'
import { listCategories, listMerchants, listOffers } from '@/api/catalog.api'
import { listBranches } from '@/api/branches.api'
import { getConfiguration, listTiers } from '@/api/settings.api'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useAuthStore } from '@/stores/auth.store'
import { P } from '@/utils/permissions'
import { DEFAULT_PAGE_SIZE } from '@/types/api'

/**
 * Dashboard overview.
 *
 * Every figure here is computed from a real endpoint, and each section is only
 * requested when the caller holds the permission for it — so a limited role sees
 * fewer cards rather than a row of errors.
 *
 * Two honesty constraints worth noting:
 *
 *  - There is no aggregate/statistics endpoint. Counts come from list endpoints,
 *    and the wallet figures come from one page of results, so those two cards say
 *    they describe the listed page rather than implying a global total.
 *  - No metric is synthesised. Where the API cannot answer something (user
 *    growth over time, voucher totals system-wide), no card is shown at all.
 */
const { t } = useI18n()
const fmt = useFormat()
const auth = useAuthStore()
const { can, canAny } = usePermissions()

// One page of wallets: enough for the tier distribution without pulling the
// whole member base.
const wallets = can(P.UserPointsRead)
  ? useAsyncResource(() => listWallets({ page: 1, pageSize: DEFAULT_PAGE_SIZE }), {
      toastOnError: false,
    })
  : null

const tiers = can(P.MembershipTiersRead)
  ? useAsyncResource(() => listTiers(), { toastOnError: false })
  : null

const offers = can(P.OffersRead)
  ? useAsyncResource(() => listOffers(), { toastOnError: false })
  : null

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const categories = can(P.CategoriesRead)
  ? useAsyncResource(() => listCategories(), { toastOnError: false })
  : null

const branches = can(P.BranchesRead)
  ? useAsyncResource(() => listBranches(), { toastOnError: false })
  : null

const configuration = can(P.LoyaltyConfigurationRead)
  ? useAsyncResource(() => getConfiguration(), { toastOnError: false })
  : null

function activeOf<T extends { isActive: boolean }>(items: T[] | null | undefined): number {
  return (items ?? []).filter((item) => item.isActive).length
}

/** Sum of available points across the fetched page, not the whole system. */
const pointsOnPage = computed(() =>
  (wallets?.data.value?.items ?? []).reduce((sum, wallet) => sum + wallet.points.available, 0),
)

const tierDistribution = computed<ChartDatum[]>(() => {
  const counts = new Map<string, number>()
  for (const wallet of wallets?.data.value?.items ?? []) {
    const name = wallet.rank?.name ?? t('wallets.noRank')
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
})

const offersByMerchant = computed<ChartDatum[]>(() => {
  const counts = new Map<string, number>()
  for (const offer of offers?.data.value ?? []) {
    const name = offer.merchantName ?? t('offers.noMerchant')
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
})

/** True when the role grants almost no reads, so the page explains itself. */
const hasLimitedView = computed(
  () =>
    !canAny(
      P.UserPointsRead,
      P.OffersRead,
      P.MerchantsRead,
      P.CategoriesRead,
      P.MembershipTiersRead,
      P.BranchesRead,
    ),
)
</script>

<template>
  <div>
    <PageHeader
      :title="$t('dashboard.greeting', { name: auth.admin?.firstName ?? '' })"
      :subtitle="$t('dashboard.subtitle')"
    />

    <BaseAlert v-if="hasLimitedView" variant="info" class="mb-5">
      {{ $t('dashboard.limitedView') }}
    </BaseAlert>

    <!-- KPIs -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        v-if="wallets"
        :label="$t('dashboard.kpi.wallets')"
        :value="fmt.number(wallets.data.value?.totalCount)"
        :hint="$t('dashboard.kpi.walletsHint')"
        :icon="Wallet"
        :loading="wallets.loading.value"
        accent="primary"
        to="/wallets"
      />

      <KpiCard
        v-if="wallets"
        :label="$t('dashboard.kpi.points')"
        :value="fmt.points(pointsOnPage)"
        :hint="$t('dashboard.kpi.pointsHint')"
        :icon="Gauge"
        :loading="wallets.loading.value"
        accent="accent"
      />

      <KpiCard
        v-if="offers"
        :label="$t('dashboard.kpi.offers')"
        :value="fmt.number(offers.data.value?.length)"
        :hint="
          $t('dashboard.kpi.offersHint', {
            active: activeOf(offers.data.value),
            total: offers.data.value?.length ?? 0,
          })
        "
        :icon="Tags"
        :loading="offers.loading.value"
        accent="success"
        to="/offers"
      />

      <KpiCard
        v-if="merchants"
        :label="$t('dashboard.kpi.merchants')"
        :value="fmt.number(merchants.data.value?.length)"
        :hint="
          $t('dashboard.kpi.merchantsHint', {
            active: activeOf(merchants.data.value),
            total: merchants.data.value?.length ?? 0,
          })
        "
        :icon="Store"
        :loading="merchants.loading.value"
        accent="info"
        to="/merchants"
      />

      <KpiCard
        v-if="tiers"
        :label="$t('dashboard.kpi.tiers')"
        :value="fmt.number(tiers.data.value?.length)"
        :hint="
          $t('dashboard.kpi.tiersHint', {
            active: activeOf(tiers.data.value),
            total: tiers.data.value?.length ?? 0,
          })
        "
        :icon="Medal"
        :loading="tiers.loading.value"
        accent="primary"
        to="/tiers"
      />

      <KpiCard
        v-if="categories"
        :label="$t('dashboard.kpi.categories')"
        :value="fmt.number(categories.data.value?.length)"
        :hint="
          $t('dashboard.kpi.categoriesHint', {
            active: activeOf(categories.data.value),
            total: categories.data.value?.length ?? 0,
          })
        "
        :icon="FolderTree"
        :loading="categories.loading.value"
        accent="info"
        to="/categories"
      />

      <KpiCard
        v-if="branches"
        :label="$t('dashboard.kpi.branches')"
        :value="fmt.number(branches.data.value?.length)"
        :hint="
          $t('dashboard.kpi.branchesHint', {
            active: activeOf(branches.data.value),
            total: branches.data.value?.length ?? 0,
          })
        "
        :icon="MapPin"
        :loading="branches.loading.value"
        accent="success"
        to="/branches"
      />

      <KpiCard
        v-if="configuration"
        :label="$t('dashboard.kpi.pointFormula')"
        :value="
          configuration.data.value
            ? `${configuration.data.value.points} / ${configuration.data.value.amountIqd}`
            : null
        "
        :hint="
          configuration.data.value
            ? $t('dashboard.kpi.pointFormulaHint', {
                points: configuration.data.value.points,
                threshold: configuration.data.value.amountIqd,
              })
            : undefined
        "
        :icon="Gauge"
        :loading="configuration.loading.value"
        accent="accent"
        to="/settings/points"
      />
    </div>

    <!-- Charts and actions -->
    <div class="mt-5 grid gap-5 lg:grid-cols-3">
      <BaseCard
        v-if="wallets"
        :title="$t('dashboard.charts.tierDistribution')"
        :subtitle="$t('dashboard.charts.tierDistributionHint')"
      >
        <BarChart :data="tierDistribution" :limit="6" />
      </BaseCard>

      <BaseCard
        v-if="offers"
        :title="$t('dashboard.charts.offersByMerchant')"
        :subtitle="$t('dashboard.charts.offersByMerchantHint')"
      >
        <BarChart :data="offersByMerchant" :limit="6" accent="accent" />
      </BaseCard>

      <BaseCard :title="$t('dashboard.quickActions.title')">
        <div class="grid gap-2">
          <BaseButton
            v-if="can(P.SubscriptionsProcess)"
            variant="secondary"
            block
            @click="$router.push({ name: 'subscriptions' })"
          >
            <template #icon><CreditCard class="size-4" /></template>
            {{ $t('dashboard.quickActions.processSubscription') }}
          </BaseButton>

          <BaseButton
            v-if="can(P.VouchersValidate)"
            variant="secondary"
            block
            @click="$router.push({ name: 'vouchers' })"
          >
            <template #icon><ScanLine class="size-4" /></template>
            {{ $t('dashboard.quickActions.validateVoucher') }}
          </BaseButton>

          <BaseButton
            v-if="can(P.OffersCreate)"
            variant="secondary"
            block
            @click="$router.push({ name: 'offers' })"
          >
            <template #icon><Tags class="size-4" /></template>
            {{ $t('dashboard.quickActions.createOffer') }}
          </BaseButton>

          <BaseButton
            v-if="can(P.LoyaltyConfigurationRead)"
            variant="secondary"
            block
            @click="$router.push({ name: 'point-settings' })"
          >
            <template #icon><Gauge class="size-4" /></template>
            {{ $t('dashboard.quickActions.pointSettings') }}
          </BaseButton>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
