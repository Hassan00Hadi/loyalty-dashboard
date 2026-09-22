<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Plus, Users } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  createBranchRule,
  deleteBranchRule,
  listBranchRules,
  updateBranchRule,
} from '@/api/branchRules.api'
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
import { DISCOUNT_TYPES, type BranchOfferRule, type DiscountType } from '@/types/models'

/**
 * Per-branch offer terms: what an offer costs at a branch, what it is worth there, and
 * how long the voucher it issues stays valid.
 *
 * Nothing here is calculated in the browser. The form collects the terms; the backend
 * validates them, applies them at activation, and snapshots them onto each voucher.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const route = useRoute()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const offerFilter = ref<string | null>(null)
const branchFilter = ref<string | null>(null)
const merchantFilter = ref<string | null>(null)

// Arriving from an offer's page pre-selects that offer.
onMounted(() => {
  const incoming = route.query.offerId
  if (typeof incoming === 'string') offerFilter.value = incoming
})

const rules = usePagedResource(
  (query) =>
    listBranchRules({
      ...query,
      offerId: offerFilter.value,
      branchId: branchFilter.value,
      merchantId: merchantFilter.value,
    }),
  {
    errorTitleKey: 'errors.loadFailed',
    watchSources: () => [offerFilter.value, branchFilter.value, merchantFilter.value],
  },
)

const offers = can(P.OffersRead)
  ? useAsyncResource(() => listOffers(), { toastOnError: false })
  : null

const branches = can(P.BranchesRead)
  ? useAsyncResource(() => listBranches(), { toastOnError: false })
  : null

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const offerOptions = computed<SelectOption[]>(
  () => offers?.data.value?.map((offer) => ({ value: offer.id, label: offer.title })) ?? [],
)

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const branchOptions = computed<SelectOption[]>(
  () => branches?.data.value?.map((branch) => ({ value: branch.id, label: branch.name })) ?? [],
)

const discountTypeOptions = computed<SelectOption[]>(() =>
  DISCOUNT_TYPES.map((type) => ({ value: type, label: t(`discountTypes.${type}`) })),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'offerTitle', label: t('branchRules.offer') },
  { key: 'branchName', label: t('branchRules.branch') },
  { key: 'requiredPoints', label: t('branchRules.requiredPoints'), align: 'end' },
  { key: 'discount', label: t('offers.discount'), align: 'end' },
  { key: 'voucherValidityDays', label: t('branchRules.voucherValidity'), align: 'end', hideBelow: 'md' },
  { key: 'completedByUserCount', label: t('branchRules.completedUsers'), align: 'end', hideBelow: 'lg' },
  { key: 'window', label: t('branchRules.startDate'), hideBelow: 'xl' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

/**
 * Formats a rule's discount according to its own type — a percentage or an amount.
 * The backend decides the value; this only chooses how to render it.
 */
function discountLabel(rule: BranchOfferRule): string {
  return rule.discountType === 'Percentage'
    ? fmt.percent(rule.discountValue)
    : fmt.currency(rule.discountValue)
}

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<BranchOfferRule | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  offerId: null as string | null,
  branchId: null as string | null,
  requiredPoints: '',
  discountType: 'Percentage' as DiscountType,
  discountValue: '',
  voucherValidityDays: '30',
  startsAtUtc: '',
  endsAtUtc: '',
  isActive: true,
})

/**
 * The branches offered by the form, narrowed to the chosen offer's merchant.
 *
 * The backend refuses a branch from another merchant; filtering here means the
 * administrator does not have to discover that by being rejected.
 */
const formBranchOptions = computed<SelectOption[]>(() => {
  const offer = offers?.data.value?.find((candidate) => candidate.id === form.value.offerId)
  if (!offer?.merchantId) return []

  return (branches?.data.value ?? [])
    .filter((branch) => branch.merchantId === offer.merchantId)
    .map((branch) => ({ value: branch.id, label: branch.name }))
})

watch(
  () => form.value.offerId,
  () => {
    const stillValid = formBranchOptions.value.some(
      (option) => option.value === form.value.branchId,
    )
    if (!stillValid) form.value.branchId = null
  },
)

const discountHint = computed(() =>
  form.value.discountType === 'Percentage'
    ? t('branchRules.discountValueHintPercentage')
    : t('branchRules.discountValueHintFixed'),
)

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`; the API returns a full ISO instant. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ''
}

function openCreate(): void {
  editing.value = null
  form.value = {
    offerId: offerFilter.value,
    branchId: null,
    requiredPoints: '',
    discountType: 'Percentage',
    discountValue: '',
    voucherValidityDays: '30',
    startsAtUtc: '',
    endsAtUtc: '',
    isActive: true,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(rule: BranchOfferRule): void {
  editing.value = rule
  form.value = {
    offerId: rule.offerId,
    branchId: rule.branchId,
    requiredPoints: String(rule.requiredPoints),
    discountType: rule.discountType,
    discountValue: String(rule.discountValue),
    voucherValidityDays: String(rule.voucherValidityDays),
    startsAtUtc: toLocalInput(rule.startsAtUtc),
    endsAtUtc: toLocalInput(rule.endsAtUtc),
    isActive: rule.isActive,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

async function save(): Promise<void> {
  if (saving.value) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    const startsAtUtc = form.value.startsAtUtc
      ? new Date(form.value.startsAtUtc).toISOString()
      : null
    const endsAtUtc = form.value.endsAtUtc
      ? new Date(form.value.endsAtUtc).toISOString()
      : null

    if (editing.value) {
      await updateBranchRule(editing.value.id, {
        requiredPoints: Number(form.value.requiredPoints),
        discountType: form.value.discountType,
        discountValue: Number(form.value.discountValue),
        voucherValidityDays: Number(form.value.voucherValidityDays),
        startsAtUtc,
        endsAtUtc,
        // Distinguishes "no window" from "leave the window alone", which both send null.
        clearWindow: startsAtUtc === null && endsAtUtc === null,
        isActive: form.value.isActive,
      })
      toast.success(t('branchRules.updated'))
    } else {
      await createBranchRule({
        offerId: form.value.offerId ?? '',
        branchId: form.value.branchId ?? '',
        requiredPoints: Number(form.value.requiredPoints),
        discountType: form.value.discountType,
        discountValue: Number(form.value.discountValue),
        voucherValidityDays: Number(form.value.voucherValidityDays),
        startsAtUtc,
        endsAtUtc,
        isActive: form.value.isActive,
      })
      toast.success(t('branchRules.created'))
    }

    modalOpen.value = false
    await rules.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function remove(rule: BranchOfferRule): Promise<void> {
  const confirmed = await confirm({
    title: t('branchRules.deleteConfirmTitle'),
    body: t('branchRules.deleteConfirmBody'),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteBranchRule(rule.id)
    toast.success(t('branchRules.deleted'))
    await rules.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

async function toggleActive(rule: BranchOfferRule): Promise<void> {
  try {
    await updateBranchRule(rule.id, { isActive: !rule.isActive })
    toast.success(t('branchRules.updated'))
    await rules.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('branchRules.title')" :subtitle="$t('branchRules.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.BranchDiscountsCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('branchRules.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert variant="info" class="mb-4">{{ $t('branchRules.snapshotNote') }}</BaseAlert>

    <BaseCard flush>
      <ListToolbar
        :has-filters="offerFilter !== null || branchFilter !== null || merchantFilter !== null"
        @clear="
          () => {
            offerFilter = null
            branchFilter = null
            merchantFilter = null
          }
        "
      >
        <template #filters>
          <div v-if="offerOptions.length" class="w-full sm:w-48">
            <BaseSelect
              v-model="offerFilter"
              :options="offerOptions"
              :placeholder="$t('branchRules.allOffers')"
            />
          </div>
          <div v-if="branchOptions.length" class="w-full sm:w-44">
            <BaseSelect
              v-model="branchFilter"
              :options="branchOptions"
              :placeholder="$t('branchRules.allBranches')"
            />
          </div>
          <div v-if="merchantOptions.length" class="w-full sm:w-44">
            <BaseSelect
              v-model="merchantFilter"
              :options="merchantOptions"
              :placeholder="$t('branchRules.allMerchants')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="rules.items.value"
        row-key="id"
        :loading="rules.loading.value"
        :refreshing="rules.refreshing.value"
        :error="rules.error.value"
        :empty-title="$t('branchRules.empty')"
        :empty-body="$t('branchRules.emptyHint')"
        @retry="rules.refresh()"
      >
        <template #cell:offerTitle="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.offerTitle ?? '—' }}</p>
            <p v-if="row.merchantName" class="truncate text-xs text-content-muted">
              {{ row.merchantName }}
            </p>
          </div>
        </template>

        <template #cell:branchName="{ row }">
          <span class="text-content-muted">{{ row.branchName ?? '—' }}</span>
        </template>

        <template #cell:requiredPoints="{ row }">
          <span class="font-semibold tabular-nums">{{ fmt.points(row.requiredPoints) }}</span>
        </template>

        <template #cell:discount="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <span class="font-semibold tabular-nums">{{ discountLabel(row) }}</span>
            <BaseBadge v-if="row.discountType === 'FixedAmount'" size="sm" variant="accent">
              {{ $t('discountTypes.FixedAmount') }}
            </BaseBadge>
          </div>
        </template>

        <template #cell:voucherValidityDays="{ row }">
          <span class="whitespace-nowrap tabular-nums text-content-muted">
            {{ $t('branchRules.voucherValidityDays', { days: fmt.number(row.voucherValidityDays) }) }}
          </span>
        </template>

        <!--
          A read-only backend statistic: distinct members who used a voucher for
          this offer at this branch. Scoped to the rule, so it is not the offer's
          own total and is never added to another branch's figure. Zero is a real
          value and shows as `0`, not the em dash used for absent data.
        -->
        <template #cell:completedByUserCount="{ row }">
          <span
            class="inline-flex items-center justify-end gap-1.5 tabular-nums"
            :title="$t('branchRules.completedUsersHint')"
          >
            <Users class="size-3.5 shrink-0 text-content-subtle" aria-hidden="true" />
            <span class="font-medium">{{ fmt.number(row.completedByUserCount ?? 0) }}</span>
          </span>
        </template>

        <template #cell:window="{ row }">
          <span v-if="row.startsAtUtc || row.endsAtUtc" class="whitespace-nowrap text-xs text-content-muted">
            {{ row.startsAtUtc ? fmt.date(row.startsAtUtc) : '—' }}
            →
            {{ row.endsAtUtc ? fmt.date(row.endsAtUtc) : '—' }}
          </span>
          <span v-else class="whitespace-nowrap text-xs text-content-subtle">
            {{ $t('common.none') }}
          </span>
        </template>

        <template #cell:isActive="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusBadge :active="row.isActive" />
            <!-- Active but outside its window: the server's own verdict, not a re-derivation. -->
            <BaseBadge v-if="row.isActive && !row.isApplicableNow" variant="warning" size="sm">
              {{ $t('branchRules.notApplicableNow') }}
            </BaseBadge>
          </div>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.BranchDiscountsUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.BranchDiscountsUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.BranchDiscountsDelete)"
              variant="ghost"
              size="sm"
              class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
              @click="remove(row)"
            >
              {{ $t('common.delete') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.BranchDiscountsCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('branchRules.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <BasePagination
          :page="rules.page.value"
          :page-size="rules.pageSize.value"
          :total-count="rules.totalCount.value"
          :total-pages="rules.totalPages.value"
          :has-next-page="rules.hasNextPage.value"
          :has-previous-page="rules.hasPreviousPage.value"
          :range-from="rules.rangeFrom.value"
          :range-to="rules.rangeTo.value"
          :disabled="rules.refreshing.value"
          class="-mx-4 -mb-3 border-t-0"
          @update:page="rules.goToPage"
          @update:page-size="rules.setPageSize"
        />
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      size="lg"
      :title="editing ? $t('branchRules.editTitle') : $t('branchRules.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <!--
          Read-only statistic for the rule being edited, kept outside the form's
          own state so it is never sent back on save. A new rule has no
          completions yet, so it only appears when editing.
        -->
        <section
          v-if="editing"
          class="flex items-center gap-3 rounded-lg bg-surface-muted p-4"
        >
          <Users class="size-5 shrink-0 text-content-subtle" aria-hidden="true" />
          <div class="min-w-0">
            <p class="text-xs text-content-muted">{{ $t('branchRules.completedUsers') }}</p>
            <p class="text-lg font-semibold tabular-nums text-content">
              {{ fmt.number(editing.completedByUserCount ?? 0) }}
            </p>
          </div>
        </section>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="form.offerId"
            :options="offerOptions"
            :label="$t('branchRules.offer')"
            :placeholder="$t('branchRules.allOffers')"
            :errors="fieldErrors.offerId"
            :disabled="editing !== null"
            required
          />
          <BaseSelect
            v-model="form.branchId"
            :options="formBranchOptions"
            :label="$t('branchRules.branch')"
            :placeholder="$t('branchRules.allBranches')"
            :errors="fieldErrors.branchId"
            :disabled="editing !== null || !form.offerId"
            required
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model="form.requiredPoints"
            type="number"
            inputmode="numeric"
            min="1"
            :label="$t('branchRules.requiredPoints')"
            :hint="$t('branchRules.requiredPointsHint')"
            :errors="fieldErrors.requiredPoints"
            dir="ltr"
            required
          />
          <BaseSelect
            v-model="form.discountType"
            :options="discountTypeOptions"
            :label="$t('branchRules.discountType')"
            :errors="fieldErrors.discountType"
            required
          />
          <BaseInput
            v-model="form.discountValue"
            type="number"
            inputmode="decimal"
            min="0"
            :max="form.discountType === 'Percentage' ? 100 : undefined"
            step="any"
            :label="$t('branchRules.discountValue')"
            :hint="discountHint"
            :errors="fieldErrors.discountValue"
            dir="ltr"
            required
          />
        </div>

        <BaseInput
          v-model="form.voucherValidityDays"
          type="number"
          inputmode="numeric"
          min="1"
          max="730"
          :label="$t('branchRules.voucherValidity')"
          :hint="$t('branchRules.voucherValidityHint')"
          :errors="fieldErrors.voucherValidityDays"
          dir="ltr"
          required
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.startsAtUtc"
            type="datetime-local"
            :label="$t('branchRules.startDate')"
            :errors="fieldErrors.startsAtUtc"
            dir="ltr"
          />
          <BaseInput
            v-model="form.endsAtUtc"
            type="datetime-local"
            :label="$t('branchRules.endDate')"
            :hint="$t('branchRules.windowHint')"
            :errors="fieldErrors.endsAtUtc"
            dir="ltr"
          />
        </div>

        <BaseToggle v-model="form.isActive" :label="$t('common.active')" />
      </form>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="modalOpen = false">
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="save">
          {{ editing ? $t('common.saveChanges') : $t('common.create') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
