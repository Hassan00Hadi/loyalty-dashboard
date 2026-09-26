<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import OfferBranchPricingModal from '@/components/ui/OfferBranchPricingModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import CheckboxGroup, { type CheckboxOption } from '@/components/forms/CheckboxGroup.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  createOffer,
  listCategories,
  listMerchants,
  searchOffers,
  updateOffer,
} from '@/api/catalog.api'
import { listBranches } from '@/api/branches.api'
import { listCities } from '@/api/cities.api'
import { listTiers } from '@/api/settings.api'
import { MAX_PAGE_SIZE } from '@/types/api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import {
  DISCOUNT_TYPES,
  type AdminOffer,
  type DiscountType,
  type OfferSortField,
  type SortDirection,
} from '@/types/models'

/**
 * Offers.
 *
 * The list is genuinely server-side: every filter, the sort order and the page
 * are query parameters on `GET /offers/search`, so the table only ever holds the
 * rows it is showing. Nothing is fetched wholesale and filtered in JavaScript.
 *
 * The form carries the two discount shapes the backend supports — a percentage
 * or a fixed amount in IQD — and the tier and branch restrictions. Validation
 * here is only to give immediate feedback; the backend remains the authority.
 */
const { t } = useI18n()
const route = useRoute()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

// ── Filters and sorting ───────────────────────────────────────────────────────

const search = ref('')
const searchQuery = useDebouncedRef(search, 350)

// Opening the page from a merchant pre-selects it, which is how the
// merchant → branches → offers flow arrives here.
const merchantFilter = ref<string | null>((route.query.merchantId as string) ?? null)
const cityFilter = ref<string | null>(null)
const categoryFilter = ref<string | null>(null)
const branchFilter = ref<string | null>(null)
const tierFilter = ref<string | null>(null)
const statusFilter = ref<string | null>(null)
const discountTypeFilter = ref<DiscountType | null>(null)

const sortBy = ref<OfferSortField>('CreatedDate')
const sortDirection = ref<SortDirection>('Descending')

const hasFilters = computed(
  () =>
    search.value.length > 0 ||
    merchantFilter.value !== null ||
    cityFilter.value !== null ||
    categoryFilter.value !== null ||
    branchFilter.value !== null ||
    tierFilter.value !== null ||
    statusFilter.value !== null ||
    discountTypeFilter.value !== null,
)

function clearFilters(): void {
  search.value = ''
  merchantFilter.value = null
  cityFilter.value = null
  categoryFilter.value = null
  branchFilter.value = null
  tierFilter.value = null
  statusFilter.value = null
  discountTypeFilter.value = null
}

/**
 * The offer list.
 *
 * Every filter below is sent to the server; `watchSources` returns to page 1
 * whenever one changes, so a narrowed search never lands on an empty page.
 */
const offers = usePagedResource(
  (query) =>
    searchOffers({
      ...query,
      search: searchQuery.value.trim() || null,
      merchantId: merchantFilter.value,
      cityId: cityFilter.value,
      categoryId: categoryFilter.value,
      branchId: branchFilter.value,
      membershipTierId: tierFilter.value,
      isActive: statusFilter.value === null ? null : statusFilter.value === 'active',
      discountType: discountTypeFilter.value,
      sortBy: sortBy.value,
      sortDirection: sortDirection.value,
    }),
  {
    errorTitleKey: 'errors.loadOffersFailed',
    watchSources: () => [
      searchQuery.value,
      merchantFilter.value,
      cityFilter.value,
      categoryFilter.value,
      branchFilter.value,
      tierFilter.value,
      statusFilter.value,
      discountTypeFilter.value,
      sortBy.value,
      sortDirection.value,
    ],
  },
)

// ── Reference data for the pickers ────────────────────────────────────────────

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const categories = can(P.CategoriesRead)
  ? useAsyncResource(() => listCategories(), { toastOnError: false })
  : null

const tiers = can(P.MembershipTiersRead)
  ? useAsyncResource(() => listTiers(), { toastOnError: false })
  : null

const cities = can(P.CitiesRead)
  ? useAsyncResource(() => listCities({ page: 1, pageSize: MAX_PAGE_SIZE, isActive: true }), {
      toastOnError: false,
    })
  : null

/**
 * Every branch, loaded once and grouped by merchant in memory.
 *
 * The branch list is small and unpaged, and both the filter and the form's
 * branch picker need it keyed by merchant; fetching per merchant would mean a
 * round trip each time the merchant field changes mid-form.
 */
const branches = can(P.BranchesRead)
  ? useAsyncResource(() => listBranches(), { toastOnError: false })
  : null

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const categoryOptions = computed<SelectOption[]>(
  () => categories?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const cityOptions = computed<SelectOption[]>(
  () => cities?.data.value?.items.map((city) => ({ value: city.id, label: city.name })) ?? [],
)

// Ordered by level so the picker reads as the rank ladder does.
const sortedTiers = computed(() => [...(tiers?.data.value ?? [])].sort((a, b) => a.level - b.level))

const tierOptions = computed<SelectOption[]>(() =>
  sortedTiers.value.map((tier) => ({ value: tier.id, label: tier.name })),
)

/** Branch options for the filter, narrowed to the filtered merchant when there is one. */
const branchFilterOptions = computed<SelectOption[]>(() =>
  (branches?.data.value ?? [])
    .filter((branch) => !merchantFilter.value || branch.merchantId === merchantFilter.value)
    .map((branch) => ({
      value: branch.id,
      label: branch.cityName ? `${branch.name} — ${branch.cityName}` : branch.name,
    })),
)

const statusOptions = computed<SelectOption[]>(() => [
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
])

const discountTypeOptions = computed<SelectOption[]>(() =>
  DISCOUNT_TYPES.map((type) => ({ value: type, label: t(`discountTypes.${type}`) })),
)

const sortOptions = computed<SelectOption[]>(() => [
  { value: 'CreatedDate', label: t('offers.sortCreatedDate') },
  { value: 'ExpiryDate', label: t('offers.sortExpiryDate') },
  { value: 'DiscountValue', label: t('offers.sortDiscountValue') },
  { value: 'RequiredPoints', label: t('offers.sortRequiredPoints') },
  { value: 'Title', label: t('offers.sortTitle') },
])

const sortDirectionOptions = computed<SelectOption[]>(() => [
  { value: 'Ascending', label: t('common.ascending') },
  { value: 'Descending', label: t('common.descending') },
])

// Choosing a different merchant invalidates a branch picked under the previous one.
watch(merchantFilter, () => {
  branchFilter.value = null
})

/**
 * Kept deliberately narrow so the row actions stay on screen at laptop width
 * rather than being pushed into the horizontal scroller. The tier, branch and
 * expiry detail is carried in the title cell and the edit form instead of
 * earning a column each.
 */
const columns = computed<TableColumn[]>(() => [
  { key: 'title', label: t('offers.offer') },
  { key: 'merchantName', label: t('offers.merchant'), hideBelow: 'lg' },
  { key: 'discount', label: t('offers.discount'), align: 'end' },
  { key: 'requiredPoints', label: t('offers.requiredPoints'), align: 'end', hideBelow: 'sm' },
  { key: 'completedByUserCount', label: t('offers.completedUsers'), align: 'end', hideBelow: 'lg' },
  { key: 'tiers', label: t('offers.tiers'), hideBelow: 'xl' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

/** A discount rendered the way its type demands: `20%` or `10,000 د.ع`. */
function discountLabel(offer: Pick<AdminOffer, 'discountType' | 'discountValue'>): string {
  return offer.discountType === 'Percentage'
    ? fmt.percent(offer.discountValue)
    : fmt.currency(offer.discountValue)
}

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<AdminOffer | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

/**
 * The form's own state.
 *
 * Each field is written only by the operator or by `openCreate` / `openEdit`.
 * Nothing recomputes one field from another — in particular, minimum spending is
 * never touched when the discount type, discount value, tier, branch or category
 * changes. That coupling is what made a typed minimum spending disappear.
 */
const form = ref({
  title: '',
  description: '',
  merchantId: null as string | null,
  cityId: null as string | null,
  requiredMembershipTierId: null as string | null,
  requiredPoints: '',
  discountType: 'Percentage' as DiscountType,
  discountValue: '',
  validDays: '',
  minimumSpending: '',
  expiresAt: '',
  applicableTierIds: [] as string[],
  appliesToAllBranches: true,
  applicableBranchIds: [] as string[],
  showQrCode: true,
  isActive: true,
})

function blankForm(): typeof form.value {
  return {
    title: '',
    description: '',
    merchantId: merchantFilter.value,
    cityId: null,
    requiredMembershipTierId: null,
    requiredPoints: '',
    discountType: 'Percentage',
    discountValue: '',
    validDays: '',
    minimumSpending: '',
    expiresAt: '',
    applicableTierIds: [],
    appliesToAllBranches: true,
    applicableBranchIds: [],
    showQrCode: true,
    isActive: true,
  }
}

function openCreate(): void {
  editing.value = null
  form.value = blankForm()
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(offer: AdminOffer): void {
  editing.value = offer
  form.value = {
    title: offer.title,
    description: offer.description ?? '',
    merchantId: offer.merchantId,
    cityId: offer.cityId,
    requiredMembershipTierId: offer.requiredMembershipTierId,
    requiredPoints: String(offer.requiredPoints),
    discountType: offer.discountType,
    discountValue: String(offer.discountValue),
    validDays: String(offer.validDays),
    minimumSpending: offer.minimumSpending === null ? '' : String(offer.minimumSpending),
    // `datetime-local` needs `YYYY-MM-DDTHH:mm` with no zone designator.
    expiresAt: offer.expiresAt ? toLocalInput(offer.expiresAt) : '',
    applicableTierIds: offer.applicableTiers.map((tier) => tier.id),
    appliesToAllBranches: offer.appliesToAllBranches,
    applicableBranchIds: offer.applicableBranches.map((branch) => branch.id),
    showQrCode: offer.showQrCode,
    isActive: offer.isActive,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

/** An API instant as the value a `datetime-local` input expects. */
function toLocalInput(value: string): string {
  const normalised = /[Z+]|-\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
  const date = new Date(normalised)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

const isPercentage = computed(() => form.value.discountType === 'Percentage')

/** The branches of the merchant currently chosen on the form. */
const formBranchOptions = computed<CheckboxOption[]>(() =>
  (branches?.data.value ?? [])
    .filter((branch) => branch.merchantId === form.value.merchantId)
    .map((branch) => ({
      value: branch.id,
      label: branch.name,
      meta: branch.cityName ?? undefined,
    })),
)

const tierCheckboxOptions = computed<CheckboxOption[]>(() =>
  sortedTiers.value.map((tier) => ({ value: tier.id, label: tier.name })),
)

/**
 * "All branches" and a specific branch selection are contradictory, so choosing
 * all clears the individual ticks rather than leaving a state that reads two
 * ways. Switching back leaves the list empty for the operator to fill.
 */
watch(
  () => form.value.appliesToAllBranches,
  (all) => {
    if (all) form.value.applicableBranchIds = []
  },
)

// Changing the merchant invalidates branches that belong to the previous one.
watch(
  () => form.value.merchantId,
  () => {
    form.value.applicableBranchIds = []
  },
)

/**
 * Immediate feedback on the discount, matching the backend's own rule:
 * a percentage in (0, 100], or any amount above zero.
 */
const discountValueError = computed<string | null>(() => {
  const raw = form.value.discountValue.trim()
  if (raw === '') return null

  const value = Number(raw)
  if (!Number.isFinite(value)) return t('validation.number')

  if (isPercentage.value) {
    return value > 0 && value <= 100 ? null : t('validation.percentageRange')
  }
  return value > 0 ? null : t('validation.amountPositive')
})

const discountErrors = computed(() => {
  const server = fieldErrors.value.discountValue ?? fieldErrors.value.discountPercentage
  if (server?.length) return server
  return discountValueError.value ? [discountValueError.value] : undefined
})

// ── Preview ───────────────────────────────────────────────────────────────────

/** The form's own state, restated for review. UI only — nothing is computed here. */
const preview = computed(() => {
  const tierNames = form.value.applicableTierIds.length
    ? sortedTiers.value
        .filter((tier) => form.value.applicableTierIds.includes(tier.id))
        .map((tier) => tier.name)
        .join('، ')
    : t('offers.allTiers')

  const branchNames = form.value.appliesToAllBranches
    ? t('offers.allBranches')
    : formBranchOptions.value
        .filter((branch) => form.value.applicableBranchIds.includes(branch.value))
        .map((branch) => branch.label)
        .join('، ') || t('offers.noBranchesSelected')

  const discountRaw = Number(form.value.discountValue)
  const discount = Number.isFinite(discountRaw) && form.value.discountValue.trim() !== ''
    ? discountLabel({ discountType: form.value.discountType, discountValue: discountRaw })
    : '—'

  const minimum = form.value.minimumSpending.trim()
  const points = Number(form.value.requiredPoints)

  return {
    title: form.value.title.trim() || '—',
    description: form.value.description.trim(),
    discount,
    minimumSpending: minimum === '' ? t('offers.noMinimumSpending') : fmt.currency(Number(minimum)),
    requiredPoints: Number.isFinite(points) && form.value.requiredPoints.trim() !== ''
      ? t('offers.requiredPointsValue', { points: fmt.points(points) })
      : '—',
    tiers: tierNames,
    branches: branchNames,
    expiresAt: form.value.expiresAt
      ? fmt.dateTime(new Date(form.value.expiresAt))
      : t('offers.neverExpires'),
  }
})

async function save(): Promise<void> {
  if (saving.value) return
  if (discountValueError.value) {
    formError.value = discountValueError.value
    return
  }

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    // An empty minimum spending means "no gate", which the API models as null
    // rather than zero.
    const minimumRaw = form.value.minimumSpending.trim()
    const minimumSpending = minimumRaw === '' ? null : Number(minimumRaw)

    // A local `datetime-local` value is sent as an instant.
    const expiresAt = form.value.expiresAt
      ? new Date(form.value.expiresAt).toISOString()
      : null

    const common = {
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      merchantId: form.value.merchantId,
      cityId: form.value.cityId,
      requiredMembershipTierId: form.value.requiredMembershipTierId,
      requiredPoints: Number(form.value.requiredPoints),
      discountType: form.value.discountType,
      discountValue: Number(form.value.discountValue),
      validDays: Number(form.value.validDays),
      applicableTierIds: form.value.applicableTierIds,
      appliesToAllBranches: form.value.appliesToAllBranches,
      applicableBranchIds: form.value.appliesToAllBranches
        ? []
        : form.value.applicableBranchIds,
      showQrCode: form.value.showQrCode,
      isActive: form.value.isActive,
    }

    if (editing.value) {
      await updateOffer(editing.value.id, {
        ...common,
        // Sent only when there is a value. Clearing it is said explicitly,
        // because a null in a sparse update means "leave it alone".
        minimumSpending: minimumSpending ?? undefined,
        clearMinimumSpending:
          minimumSpending === null && editing.value.minimumSpending !== null,
        expiresAt: expiresAt ?? undefined,
        clearExpiry: expiresAt === null && editing.value.expiresAt !== null,
      })
      toast.success(t('offers.updated'))
    } else {
      await createOffer({ ...common, minimumSpending, expiresAt })
      toast.success(t('offers.created'))
    }

    modalOpen.value = false
    await offers.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

// ── Branch pricing ────────────────────────────────────────────────────────────
// What the offer costs and gives at each branch. Not a column on the list: the
// rule count would take one request per row, so it lives in this view instead.

const pricingOffer = ref<AdminOffer | null>(null)

async function toggleActive(offer: AdminOffer): Promise<void> {
  try {
    await updateOffer(offer.id, { isActive: !offer.isActive })
    toast.success(t('offers.updated'))
    await offers.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('offers.title')" :subtitle="$t('offers.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.OffersCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('offers.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <!--
        Every control here is a query parameter. Changing one refetches the page
        from the server rather than filtering rows already in the browser.
      -->
      <ListToolbar
        v-model:search="search"
        :has-filters="hasFilters"
        @clear="clearFilters"
      >
        <template #filters>
          <div class="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
            <BaseSelect
              v-if="merchantOptions.length"
              v-model="merchantFilter"
              :options="merchantOptions"
              :placeholder="$t('offers.allMerchants')"
              :aria-label="$t('offers.filterByMerchant')"
            />
            <BaseSelect
              v-if="cityOptions.length"
              v-model="cityFilter"
              :options="cityOptions"
              :placeholder="$t('offers.allCities')"
              :aria-label="$t('offers.filterByCity')"
            />
            <BaseSelect
              v-if="categoryOptions.length"
              v-model="categoryFilter"
              :options="categoryOptions"
              :placeholder="$t('offers.allCategories')"
              :aria-label="$t('offers.filterByCategory')"
            />
            <BaseSelect
              v-if="branchFilterOptions.length"
              v-model="branchFilter"
              :options="branchFilterOptions"
              :placeholder="$t('offers.allBranchesFilter')"
              :aria-label="$t('offers.filterByBranch')"
            />
            <BaseSelect
              v-if="tierOptions.length"
              v-model="tierFilter"
              :options="tierOptions"
              :placeholder="$t('offers.allTiersFilter')"
              :aria-label="$t('offers.filterByTier')"
            />
            <BaseSelect
              v-model="statusFilter"
              :options="statusOptions"
              :placeholder="$t('offers.allStatuses')"
              :aria-label="$t('offers.filterByStatus')"
            />
            <BaseSelect
              v-model="discountTypeFilter"
              :options="discountTypeOptions"
              :placeholder="$t('offers.allDiscountTypes')"
              :aria-label="$t('offers.filterByDiscountType')"
            />
          </div>
        </template>

        <!-- Sorting is server-side too, and pagination stays server-side with it. -->
        <template #actions>
          <div class="flex items-center gap-2">
            <div class="w-36">
              <BaseSelect
                v-model="sortBy"
                :options="sortOptions"
                :aria-label="$t('common.sortBy')"
              />
            </div>
            <div class="w-32">
              <BaseSelect
                v-model="sortDirection"
                :options="sortDirectionOptions"
                :aria-label="$t('common.sortDirection')"
              />
            </div>
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="offers.items.value"
        row-key="id"
        :loading="offers.loading.value"
        :refreshing="offers.refreshing.value"
        :error="offers.error.value"
        :empty-title="$t('offers.empty')"
        :empty-body="$t('offers.emptyHint')"
        @retry="offers.refresh()"
      >
        <!--
          Carries the detail that no longer has a column of its own — minimum
          spending, branch scope and expiry — so narrowing the table did not cost
          the information.
        -->
        <template #cell:title="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.title }}</p>
            <p v-if="row.description" class="truncate text-xs text-content-muted">
              {{ row.description }}
            </p>
            <p class="truncate text-xs text-content-subtle">
              <span v-if="row.minimumSpending !== null">
                {{ $t('offers.minimumSpending') }}: {{ fmt.currency(row.minimumSpending) }} ·
              </span>
              <span>
                {{
                  row.appliesToAllBranches
                    ? $t('offers.allBranches')
                    : `${$t('offers.branches')}: ${fmt.number(row.applicableBranches.length)}`
                }}
              </span>
              <span>
                ·
                {{
                  row.expiresAt
                    ? `${$t('offers.expiresAt')}: ${fmt.date(row.expiresAt)}`
                    : $t('offers.neverExpires')
                }}
              </span>
            </p>
          </div>
        </template>

        <template #cell:merchantName="{ row }">
          <span :class="row.merchantName ? 'text-content-muted' : 'text-content-subtle'">
            {{ row.merchantName ?? $t('offers.noMerchant') }}
          </span>
        </template>

        <!-- Rendered by type: a percentage or an amount in dinar. -->
        <template #cell:discount="{ row }">
          <span class="font-medium tabular-nums">{{ discountLabel(row) }}</span>
        </template>

        <template #cell:requiredPoints="{ row }">
          <span class="tabular-nums">{{ fmt.points(row.requiredPoints) }}</span>
        </template>

        <!--
          A read-only backend statistic: distinct members who have used a voucher
          for the offer. Zero is a real value here, so it is shown as `0` rather
          than falling back to the em dash used for absent data.
        -->
        <template #cell:completedByUserCount="{ row }">
          <span class="tabular-nums" :title="$t('offers.completedUsersHint')">
            {{ fmt.points(row.completedByUserCount ?? 0) }}
          </span>
        </template>

        <template #cell:tiers="{ row }">
          <div v-if="row.applicableTiers.length" class="flex flex-wrap gap-1">
            <BaseBadge
              v-for="tier in row.applicableTiers"
              :key="tier.id"
              variant="primary"
              size="sm"
            >
              {{ tier.name }}
            </BaseBadge>
          </div>
          <span v-else class="text-xs text-content-subtle">{{ $t('offers.allTiers') }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.BranchDiscountsRead)"
              variant="ghost"
              size="sm"
              @click="pricingOffer = row"
            >
              {{ $t('branchPricing.action') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.OffersUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.OffersUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.OffersCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('offers.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <BasePagination
          :page="offers.page.value"
          :page-size="offers.pageSize.value"
          :total-count="offers.totalCount.value"
          :total-pages="offers.totalPages.value"
          :has-next-page="offers.hasNextPage.value"
          :has-previous-page="offers.hasPreviousPage.value"
          :range-from="offers.rangeFrom.value"
          :range-to="offers.rangeTo.value"
          :disabled="offers.refreshing.value"
          class="-mx-4 -mb-3 border-t-0"
          @update:page="offers.goToPage"
          @update:page-size="offers.setPageSize"
        />
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      size="xl"
      :title="editing ? $t('offers.editTitle') : $t('offers.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-5" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.title"
          :label="$t('offers.offer')"
          :errors="fieldErrors.title"
          :maxlength="256"
          required
        />

        <!-- Customer-facing copy, shown on the offer details view. -->
        <BaseTextarea
          v-model="form.description"
          :label="$t('offers.description')"
          :hint="$t('offers.descriptionHint')"
          :errors="fieldErrors.description"
          :maxlength="1024"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="form.merchantId"
            :options="merchantOptions"
            :label="$t('offers.merchant')"
            :placeholder="$t('offers.noMerchant')"
            :errors="fieldErrors.merchantId"
          />
          <BaseSelect
            v-model="form.cityId"
            :options="cityOptions"
            :label="$t('offers.city')"
            :placeholder="$t('offers.globalOffer')"
            :hint="$t('offers.cityHint')"
            :errors="fieldErrors.cityId"
          />
        </div>

        <!--
          Discount type and value. Switching the type changes how the value is
          read and validated, and nothing else — no other field is reset.
        -->
        <fieldset class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="form.discountType"
            :options="discountTypeOptions"
            :label="$t('offers.discountType')"
            :errors="fieldErrors.discountType"
            required
          />
          <BaseInput
            v-model="form.discountValue"
            type="number"
            inputmode="decimal"
            :min="isPercentage ? 0 : 0"
            :max="isPercentage ? 100 : undefined"
            step="any"
            :label="$t('offers.discountValue')"
            :hint="
              isPercentage
                ? $t('offers.discountValueHintPercentage')
                : $t('offers.discountValueHintFixed')
            "
            :errors="discountErrors"
            dir="ltr"
            required
          />
        </fieldset>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.requiredPoints"
            type="number"
            inputmode="numeric"
            min="1"
            :label="$t('offers.requiredPoints')"
            :errors="fieldErrors.requiredPoints"
            dir="ltr"
            required
          />
          <!--
            Minimum spending is plain state: it is written only here, and no
            watcher recomputes it when the discount, tier, branch or category
            changes.
          -->
          <BaseInput
            v-model="form.minimumSpending"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            :label="$t('offers.minimumSpending')"
            :hint="$t('offers.minimumSpendingHint')"
            :errors="fieldErrors.minimumSpending"
            dir="ltr"
          />
          <BaseInput
            v-model="form.validDays"
            type="number"
            inputmode="numeric"
            min="1"
            :label="$t('offers.validDays')"
            :hint="$t('offers.validDaysHint')"
            :errors="fieldErrors.validDays"
            dir="ltr"
            required
          />
          <BaseInput
            v-model="form.expiresAt"
            type="datetime-local"
            :label="$t('offers.expiresAt')"
            :hint="$t('offers.expiresAtHint')"
            :errors="fieldErrors.expiresAt"
            dir="ltr"
          />
        </div>

        <!-- Tiers allowed to redeem. None ticked means every tier. -->
        <CheckboxGroup
          v-model="form.applicableTierIds"
          :options="tierCheckboxOptions"
          :label="$t('offers.availableTiers')"
          :hint="$t('offers.tiersHint')"
          :errors="fieldErrors.applicableTierIds"
          :empty-text="$t('offers.allTiers')"
        />

        <!--
          Either every branch of the merchant, or a named set. The toggle clears
          the list so the two can never disagree.
        -->
        <div class="space-y-3 rounded-lg border border-hairline p-3">
          <BaseToggle
            v-model="form.appliesToAllBranches"
            :label="$t('offers.allBranches')"
            :hint="$t('offers.allBranchesHint')"
          />

          <CheckboxGroup
            v-if="!form.appliesToAllBranches"
            v-model="form.applicableBranchIds"
            :options="formBranchOptions"
            :label="$t('offers.applicableBranches')"
            :errors="fieldErrors.applicableBranchIds"
            :empty-text="
              form.merchantId
                ? $t('offers.noMerchantBranches')
                : $t('offers.selectMerchantFirst')
            "
            scroll
          />
        </div>

        <BaseToggle
          v-model="form.showQrCode"
          :label="$t('offers.showQrCode')"
          :hint="form.showQrCode ? $t('offers.showQrCodeOn') : $t('offers.showQrCodeOff')"
        />

        <BaseAlert v-if="editing && editing.showQrCode !== form.showQrCode" variant="info">
          {{ $t('offers.showQrCodeChangeNote') }}
        </BaseAlert>

        <BaseToggle v-model="form.isActive" :label="$t('common.active')" />

        <!--
          A summary of the form's current state, shown before saving. Display
          only: it reads the same values the save sends.
        -->
        <section class="rounded-lg bg-surface-muted p-4">
          <h3 class="text-sm font-semibold text-content">{{ $t('offers.preview') }}</h3>
          <p class="mt-0.5 text-xs text-content-subtle">{{ $t('offers.previewHint') }}</p>

          <dl class="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.offer') }}</dt>
              <dd class="font-medium text-content">{{ preview.title }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.discount') }}</dt>
              <dd class="font-medium text-content">{{ preview.discount }}</dd>
            </div>
            <div v-if="preview.description" class="sm:col-span-2">
              <dt class="text-xs text-content-muted">{{ $t('offers.description') }}</dt>
              <dd class="text-content">{{ preview.description }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.minimumSpending') }}</dt>
              <dd class="text-content">{{ preview.minimumSpending }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.requiredPoints') }}</dt>
              <dd class="text-content">{{ preview.requiredPoints }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.tiers') }}</dt>
              <dd class="text-content">{{ preview.tiers }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.branches') }}</dt>
              <dd class="text-content">{{ preview.branches }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">{{ $t('offers.expiresAt') }}</dt>
              <dd class="text-content">{{ preview.expiresAt }}</dd>
            </div>
          </dl>
        </section>
      </form>

      <template #footer>
        <!-- Opens over the form; the defaults it shows are the saved ones, not the edits. -->
        <BaseButton
          v-if="editing && can(P.BranchDiscountsRead)"
          variant="ghost"
          class="sm:me-auto"
          @click="pricingOffer = editing"
        >
          {{ $t('branchPricing.action') }}
        </BaseButton>
        <BaseButton variant="secondary" :disabled="saving" @click="modalOpen = false">
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="save">
          {{ editing ? $t('common.saveChanges') : $t('common.create') }}
        </BaseButton>
      </template>
    </BaseModal>

    <OfferBranchPricingModal
      :open="pricingOffer !== null"
      :offer="pricingOffer"
      @close="pricingOffer = null"
    />
  </div>
</template>
