<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  createPackageRule,
  listPackageRules,
  listPackages,
  listTiers,
  updatePackageRule,
} from '@/api/settings.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { PackagePointRule } from '@/types/models'

/**
 * Package point rules.
 *
 * These endpoints exist and are permissioned, so the screen is provided — but
 * subscription processing no longer reads them. The warning at the top says so
 * plainly, because a rule edited here will not change any award.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const rules = useAsyncResource(() => listPackageRules(), { toastOnError: false })

const packages = can(P.PackagesRead)
  ? useAsyncResource(() => listPackages(), { toastOnError: false })
  : null

const tiers = can(P.MembershipTiersRead)
  ? useAsyncResource(() => listTiers(), { toastOnError: false })
  : null

const packageFilter = ref<string | null>(null)

const packageOptions = computed<SelectOption[]>(
  () =>
    packages?.data.value?.map((item) => ({
      value: item.id,
      label: `${item.packageName} (${item.externalPackageId})`,
    })) ?? [],
)

const tierOptions = computed<SelectOption[]>(() =>
  [...(tiers?.data.value ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((tier) => ({ value: tier.id, label: `${tier.name} (${tier.level})` })),
)

const filtered = computed(() => {
  const all = rules.data.value ?? []
  if (!packageFilter.value) return all
  return all.filter((rule) => rule.loyaltyPackageId === packageFilter.value)
})

const columns = computed<TableColumn[]>(() => [
  { key: 'packageName', label: t('packageRules.package') },
  { key: 'membershipTierName', label: t('packageRules.tier') },
  { key: 'points', label: t('packageRules.points'), align: 'end' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const modalOpen = ref(false)
const editing = ref<PackagePointRule | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  loyaltyPackageId: null as string | null,
  membershipTierId: null as string | null,
  points: '',
  isActive: true,
})

function openCreate(): void {
  editing.value = null
  form.value = {
    loyaltyPackageId: packageFilter.value,
    membershipTierId: null,
    points: '',
    isActive: true,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(rule: PackagePointRule): void {
  editing.value = rule
  form.value = {
    loyaltyPackageId: rule.loyaltyPackageId,
    membershipTierId: rule.membershipTierId,
    points: String(rule.points),
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
    if (editing.value) {
      // The package cannot be reassigned; only tier, points and status change.
      await updatePackageRule(editing.value.id, {
        membershipTierId: form.value.membershipTierId,
        points: Number(form.value.points),
        isActive: form.value.isActive,
      })
      toast.success(t('packageRules.updated'))
    } else {
      await createPackageRule({
        loyaltyPackageId: form.value.loyaltyPackageId ?? '',
        membershipTierId: form.value.membershipTierId ?? '',
        points: Number(form.value.points),
        isActive: form.value.isActive,
      })
      toast.success(t('packageRules.created'))
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

async function toggleActive(rule: PackagePointRule): Promise<void> {
  try {
    await updatePackageRule(rule.id, { isActive: !rule.isActive })
    toast.success(t('packageRules.updated'))
    await rules.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('packageRules.title')" :subtitle="$t('packageRules.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.PackageRulesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('packageRules.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert variant="warning" class="mb-4">{{ $t('packageRules.legacyWarning') }}</BaseAlert>

    <BaseCard flush>
      <ListToolbar
        :has-filters="packageFilter !== null"
        :result-count="rules.loaded.value ? filtered.length : null"
        @clear="packageFilter = null"
      >
        <template v-if="packageOptions.length" #filters>
          <div class="w-full sm:w-56">
            <BaseSelect
              v-model="packageFilter"
              :options="packageOptions"
              :placeholder="$t('packageRules.allPackages')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :loading="rules.loading.value"
        :refreshing="rules.refreshing.value"
        :error="rules.error.value"
        :empty-title="$t('packageRules.empty')"
        :empty-body="$t('packageRules.emptyHint')"
        @retry="rules.refresh()"
      >
        <template #cell:packageName="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.packageName ?? '—' }}</p>
            <p v-if="row.externalPackageId" class="truncate font-mono text-xs text-content-muted" dir="ltr">
              {{ row.externalPackageId }}
            </p>
          </div>
        </template>

        <template #cell:membershipTierName="{ row }">
          <BaseBadge v-if="row.membershipTierName" variant="primary">
            {{ row.membershipTierName }}
          </BaseBadge>
          <span v-else class="text-content-subtle">—</span>
        </template>

        <template #cell:points="{ row }">
          <span class="font-semibold tabular-nums">{{ fmt.points(row.points) }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.PackageRulesUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.PackageRulesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.PackageRulesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('packageRules.create') }}
          </BaseButton>
        </template>
      </BaseTable>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('packageRules.editTitle') : $t('packageRules.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseSelect
          v-model="form.loyaltyPackageId"
          :options="packageOptions"
          :label="$t('packageRules.package')"
          :placeholder="$t('packageRules.allPackages')"
          :errors="fieldErrors.loyaltyPackageId"
          :disabled="editing !== null"
          required
        />
        <BaseSelect
          v-model="form.membershipTierId"
          :options="tierOptions"
          :label="$t('packageRules.tier')"
          :placeholder="$t('wallets.allTiers')"
          :errors="fieldErrors.membershipTierId"
          required
        />
        <BaseInput
          v-model="form.points"
          type="number"
          inputmode="numeric"
          min="1"
          :label="$t('packageRules.points')"
          :errors="fieldErrors.points"
          dir="ltr"
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
