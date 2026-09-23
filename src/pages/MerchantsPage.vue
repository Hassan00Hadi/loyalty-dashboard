<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import EntityAvatar from '@/components/ui/EntityAvatar.vue'
import CheckboxGroup, { type CheckboxOption } from '@/components/forms/CheckboxGroup.vue'
import ImageUploadField from '@/components/forms/ImageUploadField.vue'
import {
  createMerchantWithLogo,
  listCategories,
  listMerchants,
  updateMerchant,
  updateMerchantWithLogo,
} from '@/api/catalog.api'
import { listCities } from '@/api/cities.api'
import { MAX_PAGE_SIZE } from '@/types/api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { AdminMerchant } from '@/types/models'

/**
 * Merchants.
 *
 * Categories and cities are loaded from the API to populate the filters and the
 * form's pickers, so nothing about the taxonomy is hard-coded here.
 *
 * The cities column comes straight from the merchant's own `cities` array. It is
 * never derived by grouping branches in the browser: which cities a merchant
 * operates in is the backend's answer, and a branch list would only ever be a
 * guess at it.
 *
 * Creating a merchant is the first step of a flow — choose cities, then add
 * branches, then create offers — so a successful create offers the next step
 * rather than just closing.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const router = useRouter()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const merchants = useAsyncResource(() => listMerchants(), {
  errorTitleKey: 'errors.loadMerchantsFailed',
  toastOnError: false,
})

// Only fetched when the caller may read categories; without it the filter and
// the picker are simply unavailable rather than erroring.
const categories = can(P.CategoriesRead)
  ? useAsyncResource(() => listCategories(), { toastOnError: false })
  : null

// Every active city, for the merchant's city picker. Which of them a merchant
// trades in is what the picker sets; the backend owns the rule that a city still
// hosting a branch cannot be removed.
const cities = can(P.CitiesRead)
  ? useAsyncResource(() => listCities({ page: 1, pageSize: MAX_PAGE_SIZE, isActive: true }), {
      toastOnError: false,
    })
  : null

const search = ref('')
const categoryFilter = ref<string | null>(null)

const categoryOptions = computed<SelectOption[]>(
  () => categories?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const filtered = computed(() => {
  let all = merchants.data.value ?? []

  if (categoryFilter.value) {
    all = all.filter((merchant) => merchant.categoryId === categoryFilter.value)
  }

  const term = search.value.trim().toLowerCase()
  if (term) {
    all = all.filter(
      (merchant) =>
        merchant.name.toLowerCase().includes(term) ||
        (merchant.categoryName?.toLowerCase().includes(term) ?? false),
    )
  }

  return all
})

// Merchant | logo | cities | branch count | status — the logo travels with the
// name cell, which is where it is legible.
const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('merchants.merchant') },
  { key: 'categoryName', label: t('merchants.category'), hideBelow: 'lg' },
  { key: 'cities', label: t('merchants.cities'), hideBelow: 'sm' },
  { key: 'branchCount', label: t('merchants.branchCount'), align: 'end', hideBelow: 'md' },
  { key: 'offerCount', label: t('merchants.offerCount'), align: 'end', hideBelow: 'xl' },
  { key: 'activatedVouchers', label: t('vouchers.activatedCount'), align: 'end', hideBelow: 'lg' },
  { key: 'consumedVouchers', label: t('vouchers.consumedCount'), align: 'end', hideBelow: 'lg' },
  {
    key: 'generalVouchersConsumed',
    label: t('vouchers.generalConsumedCount'),
    align: 'end',
    hideBelow: 'lg',
  },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const cityOptions = computed<CheckboxOption[]>(() =>
  (cities?.data.value?.items ?? []).map((city) => ({ value: city.id, label: city.name })),
)

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<AdminMerchant | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

/** The merchant just created, so the flow can offer its next step. */
const created = ref<AdminMerchant | null>(null)

/**
 * The form as the user fills it in.
 *
 * The logo is the chosen `File` itself, not an attachment id: it is sent with
 * the merchant in one multipart request, and the backend creates and owns the
 * attachment. `clearLogo` records that a saved logo was removed, which a null
 * file alone cannot express — that just means "unchanged".
 */
const form = ref({
  categoryId: null as string | null,
  name: '',
  logoFile: null as File | null,
  clearLogo: false,
  backgroundFile: null as File | null,
  clearBackground: false,
  iconFile: null as File | null,
  clearIcon: false,
  description: '',
  cityIds: [] as string[],
  isActive: true,
})

function resetForm(): void {
  form.value = {
    categoryId: null,
    name: '',
    logoFile: null,
    clearLogo: false,
    backgroundFile: null,
    clearBackground: false,
    iconFile: null,
    clearIcon: false,
    description: '',
    cityIds: [],
    isActive: true,
  }
  formError.value = null
  fieldErrors.value = {}
}

function openCreate(): void {
  editing.value = null
  created.value = null
  resetForm()
  modalOpen.value = true
}

function openEdit(merchant: AdminMerchant): void {
  editing.value = merchant
  created.value = null
  form.value = {
    categoryId: merchant.categoryId,
    name: merchant.name,
    // No file chosen yet: each saved image is shown from its own `*Url` and kept
    // unless the user picks a replacement or removes it.
    logoFile: null,
    clearLogo: false,
    backgroundFile: null,
    clearBackground: false,
    iconFile: null,
    clearIcon: false,
    description: merchant.description ?? '',
    cityIds: merchant.cities.map((city) => city.id),
    isActive: merchant.isActive,
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
    // One request, image included. The server requires a category on create;
    // validation reports it if absent.
    const payload = {
      name: form.value.name.trim(),
      categoryId: form.value.categoryId ?? '',
      description: form.value.description.trim() || null,
      cityIds: form.value.cityIds,
      logoFile: form.value.logoFile,
      backgroundFile: form.value.backgroundFile,
      iconFile: form.value.iconFile,
      isActive: form.value.isActive,
    }

    if (editing.value) {
      await updateMerchantWithLogo(editing.value.id, {
        ...payload,
        // Each flag is only meaningful when no replacement was chosen for that
        // image; the server ignores it otherwise.
        clearLogo: form.value.clearLogo && !form.value.logoFile,
        clearBackground: form.value.clearBackground && !form.value.backgroundFile,
        clearIcon: form.value.clearIcon && !form.value.iconFile,
      })
      toast.success(t('merchants.updated'))
      modalOpen.value = false
    } else {
      const merchant = await createMerchantWithLogo(payload)
      // The modal stays open on create, showing the next step of the flow —
      // branches, then offers — rather than dropping the operator back on a list.
      created.value = merchant
      toast.success(t('merchants.createdNowBranches'))
    }

    await merchants.refresh()
  } catch (error) {
    // The form keeps its values and the chosen file, so a failure can be
    // corrected and retried without re-picking the image.
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

/**
 * Leaves the merchant step for the next one.
 *
 * Both destinations are opened filtered to the new merchant, so "add branches"
 * lands on that merchant's branches rather than on every merchant's.
 */
function goToBranches(merchantId: string): void {
  modalOpen.value = false
  void router.push({ name: 'branches', query: { merchantId } })
}

function goToOffers(merchantId: string): void {
  modalOpen.value = false
  void router.push({ name: 'offers', query: { merchantId } })
}

async function toggleActive(merchant: AdminMerchant): Promise<void> {
  try {
    await updateMerchant(merchant.id, { isActive: !merchant.isActive })
    toast.success(t('merchants.updated'))
    await merchants.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('merchants.title')" :subtitle="$t('merchants.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.MerchantsCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('merchants.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :has-filters="search.length > 0 || categoryFilter !== null"
        :result-count="merchants.loaded.value ? filtered.length : null"
        @clear="
          () => {
            search = ''
            categoryFilter = null
          }
        "
      >
        <template v-if="categoryOptions.length" #filters>
          <div class="w-full sm:w-48">
            <BaseSelect
              v-model="categoryFilter"
              :options="categoryOptions"
              :placeholder="$t('merchants.allCategories')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :loading="merchants.loading.value"
        :refreshing="merchants.refreshing.value"
        :error="merchants.error.value"
        :empty-title="$t('merchants.empty')"
        :empty-body="$t('merchants.emptyHint')"
        @retry="merchants.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="flex items-center gap-2.5">
            <EntityAvatar :src="row.logoUrl" :name="row.name" />
            <div class="min-w-0">
              <p class="truncate font-medium">{{ row.name }}</p>
              <p v-if="row.description" class="truncate text-xs text-content-muted">
                {{ row.description }}
              </p>
            </div>
          </div>
        </template>

        <template #cell:categoryName="{ row }">
          <span class="text-content-muted">{{ row.categoryName ?? '—' }}</span>
        </template>

        <!--
          Straight from the merchant's own `cities`. Long lists are truncated to
          a count rather than wrapping the row.
        -->
        <template #cell:cities="{ row }">
          <div v-if="row.cities.length" class="flex flex-wrap items-center gap-1">
            <BaseBadge
              v-for="city in row.cities.slice(0, 3)"
              :key="city.id"
              variant="info"
              size="sm"
            >
              {{ city.name }}
            </BaseBadge>
            <span v-if="row.cities.length > 3" class="text-xs text-content-subtle">
              +{{ fmt.number(row.cities.length - 3) }}
            </span>
          </div>
          <span v-else class="text-xs text-content-subtle">{{ $t('merchants.noCities') }}</span>
        </template>

        <template #cell:branchCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.branchCount) }}</span>
        </template>

        <template #cell:offerCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.offerCount) }}</span>
        </template>

        <template #cell:activatedVouchers="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.activatedVouchers) }}</span>
        </template>

        <template #cell:consumedVouchers="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.consumedVouchers) }}</span>
        </template>

        <template #cell:generalVouchersConsumed="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.generalVouchersConsumed) }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.BranchesRead)"
              variant="ghost"
              size="sm"
              @click="router.push({ name: 'branches', query: { merchantId: row.id } })"
            >
              {{ $t('merchants.viewBranches') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.MerchantsUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.MerchantsUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.MerchantsCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('merchants.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <p class="text-xs text-content-subtle">{{ $t('merchants.noDeleteNote') }}</p>
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('merchants.editTitle') : $t('merchants.createTitle')"
      @close="modalOpen = false"
    >
      <!--
        Once the merchant exists, the body states the flow's remaining steps —
        branches, then offers — so the next action is obvious.
      -->
      <div v-if="created" class="space-y-4">
        <BaseAlert variant="success">{{ $t('merchants.createdNowBranches') }}</BaseAlert>

        <ol class="space-y-2 text-sm text-content-muted">
          <li class="flex items-center gap-2">
            <Check class="size-4 shrink-0 text-success-600" aria-hidden="true" />
            <span>{{ $t('merchants.wizardCities') }}</span>
          </li>
          <li class="flex items-center gap-2">
            <Check class="size-4 shrink-0 text-success-600" aria-hidden="true" />
            <span>{{ $t('merchants.wizardDetails') }}</span>
          </li>
          <li class="flex items-center gap-2 font-medium text-content">
            <ArrowLeft class="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            <span>{{ $t('merchants.wizardBranches') }}</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="size-4 shrink-0" aria-hidden="true" />
            <span>{{ $t('merchants.wizardOffers') }}</span>
          </li>
        </ol>
      </div>

      <form v-else class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.name"
          :label="$t('common.name')"
          :errors="fieldErrors.name"
          :maxlength="256"
          required
        />
        <BaseSelect
          v-model="form.categoryId"
          :options="categoryOptions"
          :label="$t('merchants.category')"
          :placeholder="$t('merchants.allCategories')"
          :errors="fieldErrors.categoryId"
          required
        />
        <!--
          Choosing a file makes no request: it is held here and sent with the
          merchant when the form is saved.
        -->
        <ImageUploadField
          v-model="form.logoFile"
          v-model:cleared="form.clearLogo"
          :existing-url="editing?.logoUrl ?? null"
          :label="$t('merchants.logo')"
          :hint="$t('merchants.logoHint')"
          :upload-label="$t('common.upload')"
          :errors="fieldErrors.logo"
          :disabled="saving"
        />

        <!--
          Background and icon are independent of the logo and of each other:
          replacing or clearing one leaves the others as they are.
        -->
        <ImageUploadField
          v-model="form.backgroundFile"
          v-model:cleared="form.clearBackground"
          :existing-url="editing?.backgroundUrl ?? null"
          :label="$t('merchants.background')"
          :hint="$t('merchants.backgroundHint')"
          :upload-label="$t('common.upload')"
          :errors="fieldErrors.background"
          :disabled="saving"
        />
        <ImageUploadField
          v-model="form.iconFile"
          v-model:cleared="form.clearIcon"
          :existing-url="editing?.iconUrl ?? null"
          :label="$t('merchants.icon')"
          :hint="$t('merchants.iconHint')"
          :upload-label="$t('common.upload')"
          :errors="fieldErrors.icon"
          :disabled="saving"
          compact
        />

        <!--
          The cities the merchant operates in. Branches may only be opened in
          these, which is why this comes before branches in the flow.
        -->
        <CheckboxGroup
          v-model="form.cityIds"
          :options="cityOptions"
          :label="$t('merchants.cities')"
          :hint="editing ? $t('merchants.cityInUse') : $t('merchants.citiesHint')"
          :errors="fieldErrors.cityIds"
          :empty-text="$t('merchants.noCities')"
          scroll
        />

        <BaseTextarea
          v-model="form.description"
          :label="$t('common.description')"
          :errors="fieldErrors.description"
          :maxlength="1024"
        />
        <BaseToggle v-model="form.isActive" :label="$t('common.active')" />
      </form>

      <template #footer>
        <!--
          After a create, the footer becomes the next step of the flow rather
          than a second "create".
        -->
        <template v-if="created">
          <BaseButton variant="secondary" @click="modalOpen = false">
            {{ $t('merchants.skipForNow') }}
          </BaseButton>
          <BaseButton
            v-if="can(P.OffersCreate)"
            variant="secondary"
            @click="goToOffers(created.id)"
          >
            {{ $t('merchants.goToOffers') }}
          </BaseButton>
          <BaseButton
            v-if="can(P.BranchesCreate)"
            variant="primary"
            @click="goToBranches(created.id)"
          >
            {{ $t('merchants.goToBranches') }}
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton variant="secondary" :disabled="saving" @click="modalOpen = false">
            {{ $t('common.cancel') }}
          </BaseButton>
          <!-- `loading` also disables, which is what prevents a double submit. -->
          <BaseButton variant="primary" :loading="saving" @click="save">
            {{ saving ? $t('common.saving') : editing ? $t('common.saveChanges') : $t('common.create') }}
          </BaseButton>
        </template>
      </template>
    </BaseModal>
  </div>
</template>
