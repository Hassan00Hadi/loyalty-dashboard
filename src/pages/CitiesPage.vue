<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { createCity, deleteCity, listCities, updateCity } from '@/api/cities.api'
import { listMerchants } from '@/api/catalog.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { City } from '@/types/models'

/**
 * Cities, which belong to a merchant: Merchant → City, and separately Branch → City.
 *
 * A city is the merchant's own and is shared by every branch operating in it — several
 * branches in Baghdad all reference one Baghdad row. So the form asks only for the
 * merchant; where a city is used is decided on the branch, not here.
 *
 * The branch *filter* remains, because "which city does this branch operate in" is
 * still a useful question to ask of the list.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const search = ref('')
const merchantFilter = ref<string | null>(null)

const cities = usePagedResource(
  (query) =>
    listCities({
      ...query,
      search: search.value.trim() || null,
      merchantId: merchantFilter.value,
    }),
  {
    errorTitleKey: 'errors.loadFailed',
    watchSources: () => [search.value, merchantFilter.value],
  },
)

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('cities.city') },
  { key: 'merchantCount', label: t('cities.merchantCount'), align: 'end', hideBelow: 'sm' },
  { key: 'branchCount', label: t('cities.branchCount'), align: 'end', hideBelow: 'md' },
  { key: 'offerCount', label: t('cities.offerCount'), align: 'end', hideBelow: 'lg' },
  { key: 'isActive', label: t('common.status') },
  { key: 'createdAt', label: t('common.createdAt'), hideBelow: 'xl' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<City | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  name: '',
  description: '',
  isActive: true,
})

function openCreate(): void {
  editing.value = null
  form.value = {
    name: '',
    description: '',
    isActive: true,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(city: City): void {
  editing.value = city
  form.value = {
    name: city.name,
    description: city.description ?? '',
    isActive: city.isActive,
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
    if (editing.value) {
      await updateCity(editing.value.id, {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        isActive: form.value.isActive,
      })
      toast.success(t('cities.updated'))
    } else {
      await createCity({
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        isActive: form.value.isActive,
      })
      toast.success(t('cities.created'))
    }

    modalOpen.value = false
    await cities.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function remove(city: City): Promise<void> {
  const confirmed = await confirm({
    title: t('cities.deleteConfirmTitle'),
    body: t('cities.deleteConfirmBody', { name: city.name }),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteCity(city.id)
    toast.success(t('cities.deleted'))
    await cities.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

async function toggleActive(city: City): Promise<void> {
  try {
    await updateCity(city.id, { isActive: !city.isActive })
    toast.success(t('cities.updated'))
    await cities.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('cities.title')" :subtitle="$t('cities.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.CitiesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('cities.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :has-filters="search.length > 0 || merchantFilter !== null"
        @clear="
          () => {
            search = ''
            merchantFilter = null
          }
        "
      >
        <!-- Filtered by merchant only: a city is the merchant's, and which branches
             operate in it is a question for the branches page. -->
        <template #filters>
          <div v-if="merchantOptions.length" class="w-full sm:w-44">
            <BaseSelect
              v-model="merchantFilter"
              :options="merchantOptions"
              :placeholder="$t('cities.allMerchants')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="cities.items.value"
        row-key="id"
        :loading="cities.loading.value"
        :refreshing="cities.refreshing.value"
        :error="cities.error.value"
        :empty-title="$t('cities.empty')"
        :empty-body="$t('cities.emptyHint')"
        @retry="cities.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.name }}</p>
            <p v-if="row.description" class="truncate text-xs text-content-muted">
              {{ row.description }}
            </p>
          </div>
        </template>

        <!-- How many merchants operate here, derived from the branches that reference it. -->
        <template #cell:merchantCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.merchantCount) }}</span>
        </template>

        <!-- How many branches operate here. More than one is the normal case. -->
        <template #cell:branchCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.branchCount) }}</span>
        </template>

        <template #cell:offerCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.offerCount) }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:createdAt="{ row }">
          <span class="text-content-muted">{{ fmt.date(row.createdAt) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.CitiesUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.CitiesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.CitiesDelete)"
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
          <BaseButton v-if="can(P.CitiesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('cities.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <BasePagination
          :page="cities.page.value"
          :page-size="cities.pageSize.value"
          :total-count="cities.totalCount.value"
          :total-pages="cities.totalPages.value"
          :has-next-page="cities.hasNextPage.value"
          :has-previous-page="cities.hasPreviousPage.value"
          :range-from="cities.rangeFrom.value"
          :range-to="cities.rangeTo.value"
          :disabled="cities.refreshing.value"
          class="-mx-4 -mb-3 border-t-0"
          @update:page="cities.goToPage"
          @update:page-size="cities.setPageSize"
        />
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('cities.editTitle') : $t('cities.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <!--
          Nothing but the city itself. A city is a place shared by the whole platform —
          it belongs to no merchant and no branch, so there is nothing else to choose.
          Which merchants operate here follows from the branches that reference it.
        -->
        <BaseInput
          v-model="form.name"
          :label="$t('cities.cityName')"
          :hint="$t('cities.sharedNote')"
          :errors="fieldErrors.name"
          :maxlength="128"
          required
        />
        <BaseTextarea
          v-model="form.description"
          :label="$t('common.description')"
          :errors="fieldErrors.description"
          :maxlength="512"
        />
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
