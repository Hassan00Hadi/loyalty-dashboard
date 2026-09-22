<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Wallet } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import CopyButton from '@/components/ui/CopyButton.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { listWallets } from '@/api/wallets.api'
import { listTiers } from '@/api/settings.api'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { usePermissions } from '@/composables/usePermissions'
import { useTierLabel } from '@/composables/useTierLabel'
import { P } from '@/utils/permissions'

/**
 * The Points Wallet: user, phone number, total points and tier.
 *
 * Genuinely server-paged: only the requested page is fetched, and both the tier
 * filter and the phone-number search are real query parameters, so a large
 * member base costs one page of rows per view.
 *
 * The tier shown is the backend's `displayTier` (Bronze / Silver / Gold), never
 * recomputed here from the rank's level. There is deliberately no city column:
 * the loyalty service stores no city for a member, so displaying one would mean
 * inventing a relationship the API does not model.
 */
const { t } = useI18n()
const fmt = useFormat()
const router = useRouter()
const { can } = usePermissions()
const { tierLabel } = useTierLabel()

const tierFilter = ref<string | null>(null)
const search = ref('')

/**
 * Debounced so that typing a phone number issues one request rather than one per
 * keystroke — the search is a server round trip, not a filter over loaded rows.
 */
const searchQuery = useDebouncedRef(search, 350)

const wallets = usePagedResource(
  (query) =>
    listWallets({
      ...query,
      membershipTierId: tierFilter.value,
      phoneNumber: searchQuery.value.trim() || null,
    }),
  {
    errorTitleKey: 'errors.loadWalletsFailed',
    watchSources: () => [tierFilter.value, searchQuery.value],
  },
)

const tiers = can(P.MembershipTiersRead)
  ? useAsyncResource(() => listTiers(), { toastOnError: false })
  : null

const tierOptions = computed<SelectOption[]>(() =>
  [...(tiers?.data.value ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((tier) => ({ value: tier.id, label: tier.name })),
)

/**
 * The columns the Points Wallet shows: user, phone number, total points, tier.
 *
 * No city column, by design — see the note at the top of this file.
 */
const columns = computed<TableColumn[]>(() => [
  { key: 'userId', label: t('wallets.user'), mono: true },
  { key: 'phoneNumber', label: t('wallets.phoneNumber'), hideBelow: 'sm' },
  { key: 'points', label: t('wallets.totalPoints'), align: 'end' },
  { key: 'rank', label: t('wallets.tier') },
  { key: 'updatedAt', label: t('wallets.updatedAt'), hideBelow: 'lg' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])
</script>

<template>
  <div>
    <PageHeader :title="$t('wallets.title')" :subtitle="$t('wallets.subtitle')" />

    <BaseAlert variant="info" class="mb-4">
      <span class="flex items-start gap-1.5">
        <span>{{ $t('wallets.apiNote') }}</span>
      </span>
    </BaseAlert>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :search-placeholder="$t('wallets.searchByPhone')"
        :has-filters="search.length > 0 || tierFilter !== null"
        @clear="
          () => {
            search = ''
            tierFilter = null
          }
        "
      >
        <template v-if="tierOptions.length" #filters>
          <div class="w-full sm:w-44">
            <BaseSelect
              v-model="tierFilter"
              :options="tierOptions"
              :placeholder="$t('wallets.allTiers')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="wallets.items.value"
        row-key="userId"
        :loading="wallets.loading.value"
        :refreshing="wallets.refreshing.value"
        :error="wallets.error.value"
        :empty-title="$t('wallets.empty')"
        :empty-body="$t('wallets.emptyHint')"
        @retry="wallets.refresh()"
      >
        <template #cell:userId="{ row }">
          <div class="flex items-center gap-1.5">
            <span class="truncate" :title="row.userId" dir="ltr">{{ fmt.shortId(row.userId) }}</span>
            <CopyButton :value="row.userId" />
          </div>
        </template>

        <!-- Latin digits read left-to-right even in the Arabic layout. -->
        <template #cell:phoneNumber="{ row }">
          <span v-if="row.phoneNumber" class="tabular-nums" dir="ltr">{{ row.phoneNumber }}</span>
          <span v-else class="text-xs text-content-subtle">
            {{ $t('wallets.noPhoneNumber') }}
          </span>
        </template>

        <template #cell:points="{ row }">
          <span class="font-semibold tabular-nums">{{ fmt.points(row.points.available) }}</span>
        </template>

        <!--
          The tier the backend derived (`displayTier`), localised for display.
          The rank's own name is kept as the title so the underlying record stays
          discoverable without a second column.
        -->
        <template #cell:rank="{ row }">
          <BaseBadge v-if="row.rank" variant="primary" :title="row.rank.name">
            {{ tierLabel(row.rank.displayTier, row.rank.name) }}
          </BaseBadge>
          <span v-else class="text-xs text-content-subtle">{{ $t('wallets.noRank') }}</span>
        </template>

        <template #cell:updatedAt="{ row }">
          <span class="text-content-muted">{{ fmt.dateTime(row.updatedAt) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <BaseButton
            variant="secondary"
            size="sm"
            @click="router.push({ name: 'wallet-detail', params: { userId: row.userId } })"
          >
            <template #icon><Wallet class="size-3.5" /></template>
            {{ $t('common.view') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <BasePagination
          :page="wallets.page.value"
          :page-size="wallets.pageSize.value"
          :total-count="wallets.totalCount.value"
          :total-pages="wallets.totalPages.value"
          :has-next-page="wallets.hasNextPage.value"
          :has-previous-page="wallets.hasPreviousPage.value"
          :range-from="wallets.rangeFrom.value"
          :range-to="wallets.rangeTo.value"
          :disabled="wallets.refreshing.value"
          class="-mx-4 -mb-3 border-t-0"
          @update:page="wallets.goToPage"
          @update:page-size="wallets.setPageSize"
        />
      </template>
    </BaseCard>

    <!--
      The phone-number search is a query parameter, so the pagination footer
      already reports the true total for the current filters and no separate
      "showing n of the loaded page" caveat is needed.
    -->
  </div>
</template>
