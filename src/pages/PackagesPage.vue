<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { createPackage, listPackages, updatePackage } from '@/api/settings.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { LoyaltyPackage } from '@/types/models'

/**
 * Loyalty packages.
 *
 * These record the billing system's packages for reference. They no longer drive
 * point awards — subscription processing uses the price and the global point
 * settings — and the page says so, so nobody edits a package expecting the
 * award to change.
 *
 * `externalPackageId` is immutable after creation: the API's update request
 * accepts only the name and the active flag.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const packages = useAsyncResource(() => listPackages(), {
  errorTitleKey: 'errors.loadPackagesFailed',
  toastOnError: false,
})

const search = ref('')

const filtered = computed(() => {
  const all = packages.data.value ?? []
  const term = search.value.trim().toLowerCase()
  if (!term) return all
  return all.filter(
    (item) =>
      item.packageName.toLowerCase().includes(term) ||
      item.externalPackageId.toLowerCase().includes(term),
  )
})

const columns = computed<TableColumn[]>(() => [
  { key: 'packageName', label: t('packages.package') },
  { key: 'externalPackageId', label: t('packages.externalPackageId'), mono: true },
  { key: 'isActive', label: t('common.status') },
  { key: 'createdAt', label: t('common.createdAt'), hideBelow: 'lg' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const modalOpen = ref(false)
const editing = ref<LoyaltyPackage | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({ externalPackageId: '', packageName: '', isActive: true })

function openCreate(): void {
  editing.value = null
  form.value = { externalPackageId: '', packageName: '', isActive: true }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(item: LoyaltyPackage): void {
  editing.value = item
  form.value = {
    externalPackageId: item.externalPackageId,
    packageName: item.packageName,
    isActive: item.isActive,
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
      // The external id is not part of the update contract, so it is not sent.
      await updatePackage(editing.value.id, {
        packageName: form.value.packageName.trim(),
        isActive: form.value.isActive,
      })
      toast.success(t('packages.updated'))
    } else {
      await createPackage({
        externalPackageId: form.value.externalPackageId.trim(),
        packageName: form.value.packageName.trim(),
        isActive: form.value.isActive,
      })
      toast.success(t('packages.created'))
    }

    modalOpen.value = false
    await packages.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function toggleActive(item: LoyaltyPackage): Promise<void> {
  try {
    await updatePackage(item.id, { isActive: !item.isActive })
    toast.success(t('packages.updated'))
    await packages.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('packages.title')" :subtitle="$t('packages.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.PackagesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('packages.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert variant="info" class="mb-4">{{ $t('packages.legacyNote') }}</BaseAlert>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :has-filters="search.length > 0"
        :result-count="packages.loaded.value ? filtered.length : null"
        @clear="search = ''"
      />

      <BaseTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :loading="packages.loading.value"
        :refreshing="packages.refreshing.value"
        :error="packages.error.value"
        :empty-title="$t('packages.empty')"
        :empty-body="$t('packages.emptyHint')"
        @retry="packages.refresh()"
      >
        <template #cell:packageName="{ row }">
          <span class="font-medium">{{ row.packageName }}</span>
        </template>

        <template #cell:externalPackageId="{ row }">
          <span class="text-content-muted" dir="ltr">{{ row.externalPackageId }}</span>
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
              v-if="can(P.PackagesUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.PackagesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.PackagesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('packages.create') }}
          </BaseButton>
        </template>
      </BaseTable>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('packages.editTitle') : $t('packages.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.externalPackageId"
          :label="$t('packages.externalPackageId')"
          :hint="$t('packages.externalPackageIdHint')"
          :errors="fieldErrors.externalPackageId"
          :maxlength="128"
          :readonly="editing !== null"
          :disabled="editing !== null"
          dir="ltr"
          placeholder="PKG-300"
          required
        />
        <BaseInput
          v-model="form.packageName"
          :label="$t('packages.packageName')"
          :errors="fieldErrors.packageName"
          :maxlength="256"
          required
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
