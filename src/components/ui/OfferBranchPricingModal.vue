<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ExternalLink, Plus } from 'lucide-vue-next'
import BaseAlert from './BaseAlert.vue'
import BaseBadge from './BaseBadge.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import StatusBadge from './StatusBadge.vue'
import BranchRuleFormModal from '@/components/forms/BranchRuleFormModal.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import { deleteBranchRule, listBranchRules, updateBranchRule } from '@/api/branchRules.api'
import { listBranches } from '@/api/branches.api'
import { MAX_PAGE_SIZE } from '@/types/api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import {
  effectiveBranchRows,
  type EffectiveBranchRow,
  type PricingBranch,
} from '@/utils/offerPricing'
import type { AdminOffer, BranchOfferRule } from '@/types/models'

/**
 * What one offer costs and gives at each of its branches.
 *
 * The same precedence the member-facing offer endpoints apply with a `branchId`: a
 * branch rule replaces the offer's defaults at that branch, and a branch without one
 * uses the defaults. Built from the admin endpoints only — the offer the page already
 * holds, one read of the offer's rules, and one read of its merchant's branches — so
 * opening it costs two requests however many branches there are.
 */
const props = defineProps<{
  open: boolean
  offer: AdminOffer | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor } = useApiError()

const canReadRules = can(P.BranchDiscountsRead)
const canReadBranches = can(P.BranchesRead)

// ── Data ──────────────────────────────────────────────────────────────────────

// One request for every rule of the offer, never one per branch. A merchant with
// more than a page of rules on one offer is flagged below rather than silently cut.
const rules = useAsyncResource(
  () => listBranchRules({ offerId: props.offer!.id, page: 1, pageSize: MAX_PAGE_SIZE }),
  { immediate: false, toastOnError: false },
)

// The merchant's branches, for "all branches" offers and for each branch's own
// active flag. One request, filtered on the server by merchant.
const branches = useAsyncResource(() => listBranches(props.offer!.merchantId), {
  immediate: false,
  toastOnError: false,
})

watch(
  () => [props.open, props.offer?.id] as const,
  ([open]) => {
    const offer = props.offer
    if (!open || !offer?.merchantId || !canReadRules) return
    rules.data.value = null
    branches.data.value = null
    void rules.execute()
    if (canReadBranches) void branches.execute()
  },
)

const loading = computed(() => rules.loading.value || branches.loading.value)
const error = computed(() => rules.error.value ?? branches.error.value)

function reload(): void {
  void rules.refresh()
  if (canReadBranches) void branches.refresh()
}

const ruleList = computed(() => rules.data.value?.items ?? [])

const truncated = computed(
  () => (rules.data.value?.totalCount ?? 0) > ruleList.value.length,
)

/**
 * The branches the offer can be redeemed at.
 *
 * A restricted offer names its branches itself; an "all branches" offer means every
 * branch of its merchant, which needs the branch list. Without `Branches.Read` that
 * list is unavailable, so only branches that carry a rule can be shown.
 */
const scopeBranches = computed<PricingBranch[] | null>(() => {
  const offer = props.offer
  if (!offer) return null

  const merchantBranches = branches.data.value
  const byId = new Map((merchantBranches ?? []).map((branch) => [branch.id, branch]))

  if (!offer.appliesToAllBranches) {
    return offer.applicableBranches.map((ref) => ({
      id: ref.id,
      name: ref.name,
      cityName: ref.cityName,
      isActive: byId.get(ref.id)?.isActive ?? null,
    }))
  }

  if (!merchantBranches) return null
  return merchantBranches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    cityName: branch.cityName,
    isActive: branch.isActive,
  }))
})

/** True when an "all branches" offer's branches cannot be listed. */
const branchesUnknown = computed(
  () => props.offer?.appliesToAllBranches === true && !canReadBranches,
)

const rows = computed<EffectiveBranchRow[]>(() => {
  const offer = props.offer
  if (!offer || !rules.data.value) return []

  if (branchesUnknown.value) {
    // Only the ruled branches are known; each is still inside the offer's scope.
    const known = ruleList.value.map((rule) => ({
      id: rule.branchId,
      name: rule.branchName ?? rule.branchId,
      cityName: null,
      isActive: null,
    }))
    return effectiveBranchRows(offer, known, ruleList.value)
  }

  if (!scopeBranches.value) return []
  return effectiveBranchRows(offer, scopeBranches.value, ruleList.value)
})

const overrideCount = computed(() => ruleList.value.length)

const columns = computed<TableColumn[]>(() => [
  { key: 'branch', label: t('branchRules.branch') },
  { key: 'source', label: t('branchPricing.source') },
  { key: 'requiredPoints', label: t('branchRules.requiredPoints'), align: 'end' },
  { key: 'discount', label: t('offers.discount'), align: 'end' },
  { key: 'validityDays', label: t('branchRules.voucherValidity'), align: 'end', hideBelow: 'md' },
  { key: 'status', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Display ───────────────────────────────────────────────────────────────────

const defaults = computed(() => {
  const offer = props.offer
  if (!offer) return null
  return {
    points: fmt.points(offer.requiredPoints),
    discount: fmt.discount(offer.discountType, offer.discountValue),
    validity: t('branchRules.voucherValidityDays', { days: fmt.number(offer.validDays) }),
  }
})

/** An overridden value stands out, and says what it replaced. */
function overrideClass(overridden: boolean): string {
  return overridden ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-content'
}

function defaultTitle(overridden: boolean, value: string | undefined): string | undefined {
  return overridden && value ? t('branchRules.offerDefault', { value }) : undefined
}

// ── Actions ───────────────────────────────────────────────────────────────────

const formOpen = ref(false)
const editingRule = ref<BranchOfferRule | null>(null)
const presetBranchId = ref<string | null>(null)

/** What the form may choose from: the offer's scope, tagged with its merchant. */
const formBranches = computed(() => {
  const merchantId = props.offer?.merchantId ?? ''
  return rows.value.map((row) => ({ id: row.branch.id, name: row.branch.name, merchantId }))
})

function addRule(row: EffectiveBranchRow): void {
  editingRule.value = null
  presetBranchId.value = row.branch.id
  formOpen.value = true
}

function editRule(rule: BranchOfferRule): void {
  editingRule.value = rule
  presetBranchId.value = rule.branchId
  formOpen.value = true
}

const busy = ref(new Set<string>())

async function toggleRule(rule: BranchOfferRule): Promise<void> {
  if (busy.value.has(rule.id)) return
  busy.value.add(rule.id)
  try {
    await updateBranchRule(rule.id, { isActive: !rule.isActive })
    toast.success(t('branchRules.updated'))
    await rules.refresh()
  } catch (caught) {
    toast.error(t('errors.saveFailed'), messageFor(caught))
  } finally {
    busy.value.delete(rule.id)
  }
}

async function removeRule(rule: BranchOfferRule): Promise<void> {
  const confirmed = await confirm({
    title: t('branchRules.deleteConfirmTitle'),
    body: t('branchRules.deleteConfirmBody'),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  busy.value.add(rule.id)
  try {
    await deleteBranchRule(rule.id)
    toast.success(t('branchRules.deleted'))
    await rules.refresh()
  } catch (caught) {
    toast.error(t('errors.deleteFailed'), messageFor(caught))
  } finally {
    busy.value.delete(rule.id)
  }
}

function openRulesPage(): void {
  if (!props.offer) return
  emit('close')
  void router.push({ name: 'branch-rules', query: { offerId: props.offer.id } })
}
</script>

<template>
  <BaseModal
    :open="open"
    size="xl"
    :title="$t('branchPricing.title')"
    :description="offer?.title"
    @close="emit('close')"
  >
    <div v-if="offer" class="space-y-4">
      <BaseAlert v-if="!canReadRules" variant="warning">
        {{ $t('branchPricing.noPermission') }}
      </BaseAlert>

      <BaseAlert v-else-if="!offer.merchantId" variant="info">
        {{ $t('branchPricing.noMerchant') }}
      </BaseAlert>

      <template v-else>
        <!-- The baseline every branch without a rule uses. -->
        <section class="rounded-lg bg-surface-muted p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-content">{{ $t('branchPricing.defaults') }}</h3>
            <BaseBadge v-if="rules.data.value" :variant="overrideCount ? 'primary' : 'neutral'" size="sm">
              {{
                overrideCount
                  ? $t('branchPricing.overrideCount', { count: fmt.number(overrideCount) }, overrideCount)
                  : $t('branchPricing.defaultsOnly')
              }}
            </BaseBadge>
          </div>
          <dl v-if="defaults" class="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt class="text-xs text-content-muted">{{ $t('branchRules.requiredPoints') }}</dt>
              <dd class="font-medium tabular-nums text-content">{{ defaults.points }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.discount') }}</dt>
              <dd class="font-medium tabular-nums text-content">{{ defaults.discount }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('branchRules.voucherValidity') }}</dt>
              <dd class="font-medium text-content">{{ defaults.validity }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('common.status') }}</dt>
              <dd><StatusBadge :active="offer.isActive" /></dd>
            </div>
          </dl>
        </section>

        <BaseAlert v-if="branchesUnknown" variant="info">
          {{ $t('branchPricing.branchesUnknown') }}
        </BaseAlert>
        <BaseAlert v-if="truncated" variant="warning">
          {{ $t('branchPricing.truncated', { count: fmt.number(ruleList.length) }) }}
        </BaseAlert>

        <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-hairline">
          <BaseTable
            :columns="columns"
            :rows="rows"
            :row-key="(row: EffectiveBranchRow) => row.branch.id"
            :loading="loading"
            :refreshing="rules.refreshing.value"
            :error="error"
            :empty-title="$t('branchPricing.empty')"
            :empty-body="
              offer.appliesToAllBranches
                ? $t('branchPricing.emptyMerchant')
                : $t('branchPricing.emptyRestricted')
            "
            @retry="reload"
          >
            <template #cell:branch="{ row }">
              <div class="min-w-0" :class="row.branch.isActive === false ? 'opacity-60' : ''">
                <p class="truncate font-medium">{{ row.branch.name }}</p>
                <p v-if="row.branch.cityName" class="truncate text-xs text-content-muted">
                  {{ row.branch.cityName }}
                </p>
                <div
                  v-if="row.branch.isActive === false || !row.inScope"
                  class="mt-1 flex flex-wrap gap-1"
                >
                  <BaseBadge v-if="row.branch.isActive === false" size="sm">
                    {{ $t('branchPricing.inactiveBranch') }}
                  </BaseBadge>
                  <BaseBadge v-if="!row.inScope" variant="warning" size="sm">
                    {{ $t('branchPricing.outOfScope') }}
                  </BaseBadge>
                </div>
              </div>
            </template>

            <template #cell:source="{ row }">
              <BaseBadge :variant="row.rule ? 'primary' : 'neutral'" size="sm">
                {{ row.rule ? $t('branchPricing.sourceRule') : $t('branchPricing.sourceDefault') }}
              </BaseBadge>
            </template>

            <template #cell:requiredPoints="{ row }">
              <span
                class="tabular-nums"
                :class="overrideClass(row.overrides.requiredPoints)"
                :title="defaultTitle(row.overrides.requiredPoints, defaults?.points)"
              >
                {{ fmt.points(row.requiredPoints) }}
              </span>
            </template>

            <template #cell:discount="{ row }">
              <span
                class="whitespace-nowrap tabular-nums"
                :class="overrideClass(row.overrides.discount)"
                :title="defaultTitle(row.overrides.discount, defaults?.discount)"
              >
                {{ fmt.discount(row.discountType, row.discountValue) }}
              </span>
            </template>

            <template #cell:validityDays="{ row }">
              <span
                class="whitespace-nowrap tabular-nums"
                :class="overrideClass(row.overrides.validityDays)"
                :title="defaultTitle(row.overrides.validityDays, defaults?.validity)"
              >
                {{ $t('branchRules.voucherValidityDays', { days: fmt.number(row.validityDays) }) }}
              </span>
            </template>

            <!-- The server's verdict (`isApplicableNow`); the window is never re-derived here. -->
            <template #cell:status="{ row }">
              <StatusBadge v-if="row.status === 'default'" :active="offer.isActive" />
              <StatusBadge v-else-if="row.status === 'active'" :active="true" />
              <StatusBadge v-else-if="row.status === 'inactive'" :active="false" />
              <div v-else class="space-y-0.5">
                <BaseBadge variant="warning" size="sm" dot>
                  {{ $t('branchPricing.outsideWindow') }}
                </BaseBadge>
                <p class="whitespace-nowrap text-[0.6875rem] text-content-muted">
                  {{ row.rule?.startsAtUtc ? fmt.dateTime(row.rule.startsAtUtc) : '—' }}
                  →
                  {{ row.rule?.endsAtUtc ? fmt.dateTime(row.rule.endsAtUtc) : '—' }}
                </p>
              </div>
            </template>

            <template #cell:actions="{ row }">
              <div class="flex items-center justify-end gap-1.5">
                <template v-if="row.rule">
                  <BaseButton
                    v-if="can(P.BranchDiscountsUpdate)"
                    variant="ghost"
                    size="sm"
                    :loading="busy.has(row.rule.id)"
                    @click="toggleRule(row.rule)"
                  >
                    {{ row.rule.isActive ? $t('common.deactivate') : $t('common.activate') }}
                  </BaseButton>
                  <BaseButton
                    v-if="can(P.BranchDiscountsUpdate)"
                    variant="secondary"
                    size="sm"
                    @click="editRule(row.rule)"
                  >
                    {{ $t('branchPricing.editRule') }}
                  </BaseButton>
                  <BaseButton
                    v-if="can(P.BranchDiscountsDelete)"
                    variant="ghost"
                    size="sm"
                    class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                    :title="$t('branchRules.deleteConfirmBody')"
                    @click="removeRule(row.rule)"
                  >
                    {{ $t('common.delete') }}
                  </BaseButton>
                </template>
                <BaseButton
                  v-else-if="can(P.BranchDiscountsCreate)"
                  variant="secondary"
                  size="sm"
                  @click="addRule(row)"
                >
                  <template #icon><Plus class="size-4" /></template>
                  {{ $t('branchPricing.addRule') }}
                </BaseButton>
              </div>
            </template>
          </BaseTable>
        </div>

        <p class="text-xs text-content-subtle">{{ $t('branchRules.snapshotNote') }}</p>
      </template>
    </div>

    <template #footer>
      <BaseButton v-if="canReadRules && offer?.merchantId" variant="ghost" @click="openRulesPage">
        <template #icon><ExternalLink class="size-4" /></template>
        {{ $t('branchPricing.openRulesPage') }}
      </BaseButton>
      <BaseButton variant="secondary" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
    </template>
  </BaseModal>

  <BranchRuleFormModal
    :open="formOpen"
    :rule="editingRule"
    :offers="offer ? [offer] : []"
    :branches="formBranches"
    :preset-offer-id="offer?.id ?? null"
    :preset-branch-id="presetBranchId"
    lock-target
    @close="formOpen = false"
    @saved="rules.refresh()"
  />
</template>
