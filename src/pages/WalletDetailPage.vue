<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Coins, Medal, RefreshCw } from 'lucide-vue-next'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseErrorState from '@/components/ui/BaseErrorState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import CopyButton from '@/components/ui/CopyButton.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import TransactionsTable from '@/components/tables/TransactionsTable.vue'
import VouchersTable from '@/components/tables/VouchersTable.vue'
import { getWallet } from '@/api/wallets.api'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { P } from '@/utils/permissions'

/**
 * One member's wallet.
 *
 * Sections are limited to what the API returns for a user id: the wallet summary
 * with points and rank, their point transactions, and their vouchers. There is
 * no profile or subscription-history endpoint, so no such section is shown.
 */
const route = useRoute()
const { t } = useI18n()
const fmt = useFormat()
const { can } = usePermissions()

const userId = computed(() => String(route.params.userId ?? ''))

const wallet = useAsyncResource(() => getWallet(userId.value), {
  errorTitleKey: 'errors.loadWalletsFailed',
  toastOnError: false,
})

const activeTab = ref('transactions')

const tabs = computed<TabItem[]>(() => {
  const items: TabItem[] = []
  if (can(P.UserPointsRead)) {
    items.push({ value: 'transactions', label: t('transactions.title') })
  }
  if (can(P.UserVouchersRead)) {
    items.push({ value: 'vouchers', label: t('vouchers.title') })
  }
  return items
})
</script>

<template>
  <div>
    <PageHeader :title="$t('wallets.detailTitle')" :subtitle="$t('wallets.summary')">
      <template #actions>
        <BaseButton variant="secondary" @click="$router.push({ name: 'wallets' })">
          <template #icon><ArrowLeft class="size-4 rtl:rotate-180" /></template>
          {{ $t('common.back') }}
        </BaseButton>
        <BaseButton
          variant="ghost"
          icon-only
          :label="$t('common.refresh')"
          :loading="wallet.refreshing.value"
          @click="wallet.refresh()"
        >
          <template #icon><RefreshCw class="size-4" /></template>
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Summary -->
    <div v-if="wallet.loading.value" class="grid gap-4 sm:grid-cols-3">
      <BaseSkeleton v-for="card in 3" :key="card" height="h-24" rounded="rounded-card" />
    </div>

    <BaseCard v-else-if="wallet.error.value" flush>
      <BaseErrorState :error="wallet.error.value" @retry="wallet.refresh()" />
    </BaseCard>

    <div v-else-if="wallet.data.value" class="grid gap-4 sm:grid-cols-3">
      <BaseCard>
        <div class="flex items-start gap-3">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 dark:bg-accent-500/10"
            aria-hidden="true"
          >
            <Coins class="size-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-content-muted">{{ $t('wallets.points') }}</p>
            <p class="mt-0.5 text-2xl font-semibold tabular-nums text-content">
              {{ fmt.points(wallet.data.value.points.available) }}
            </p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-start gap-3">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/15"
            aria-hidden="true"
          >
            <Medal class="size-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-content-muted">{{ $t('wallets.rank') }}</p>
            <div class="mt-1.5">
              <BaseBadge v-if="wallet.data.value.rank" variant="primary">
                {{ wallet.data.value.rank.name }}
              </BaseBadge>
              <span v-else class="text-sm text-content-subtle">{{ $t('wallets.noRank') }}</span>
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <p class="text-xs font-medium text-content-muted">{{ $t('wallets.userId') }}</p>
        <div class="mt-1 flex items-center gap-1.5">
          <span class="truncate font-mono text-xs text-content" :title="userId" dir="ltr">
            {{ userId }}
          </span>
          <CopyButton :value="userId" />
        </div>
        <p class="mt-2 text-xs text-content-subtle">
          {{ $t('wallets.updatedAt') }}: {{ fmt.dateTime(wallet.data.value.updatedAt) }}
        </p>
      </BaseCard>
    </div>

    <!-- History -->
    <BaseCard v-if="tabs.length" flush class="mt-5">
      <template #header>
        <BaseTabs v-model="activeTab" :tabs="tabs" class="-mx-4 -my-3.5 border-b-0 sm:-mx-5" />
      </template>

      <TransactionsTable
        v-if="activeTab === 'transactions' && can(P.UserPointsRead)"
        :user-id="userId"
      />
      <VouchersTable
        v-else-if="activeTab === 'vouchers' && can(P.UserVouchersRead)"
        :user-id="userId"
      />
    </BaseCard>
  </div>
</template>
