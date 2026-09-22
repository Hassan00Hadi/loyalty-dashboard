<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { createTier, listTiers, updateTier } from '@/api/settings.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import { resolveAssetUrl } from '@/utils/assets'
import type { MembershipTier } from '@/types/models'

/**
 * Membership tiers.
 *
 * A tier is ordered by `level`, not by a points threshold — the backend has no
 * such field, so the table shows level and says what it means rather than
 * inventing a "minimum points" column.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

/**
 * Tiers whose icon the browser could not load.
 *
 * An image is fetched by the browser directly, with no `Authorization` header,
 * so a URL can fail for reasons this page cannot see — a deleted attachment
 * (404) or an unauthenticated read (401).
 */
const failedIcons = reactive(new Set<string>())

const tiers = useAsyncResource(() => listTiers(), {
  errorTitleKey: 'errors.loadTiersFailed',
  toastOnError: false,
})

/** Ascending by level, so the table reads bottom-of-ladder first. */
const ordered = computed(() =>
  [...(tiers.data.value ?? [])].sort((a, b) => a.level - b.level),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'level', label: t('tiers.level'), align: 'center', width: '5rem' },
  { key: 'name', label: t('tiers.tier') },
  { key: 'description', label: t('common.description'), hideBelow: 'md' },
  { key: 'isActive', label: t('common.status') },
  { key: 'createdAt', label: t('common.createdAt'), hideBelow: 'xl' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const modalOpen = ref(false)
const editing = ref<MembershipTier | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({ name: '', level: '', description: '', iconUrl: '', isActive: true })

function openCreate(): void {
  editing.value = null
  // Suggests the next free level so the ladder stays contiguous by default.
  const highest = Math.max(0, ...(tiers.data.value ?? []).map((tier) => tier.level))
  form.value = {
    name: '',
    level: String(highest + 1),
    description: '',
    iconUrl: '',
    isActive: true,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(tier: MembershipTier): void {
  editing.value = tier
  form.value = {
    name: tier.name,
    level: String(tier.level),
    description: tier.description ?? '',
    iconUrl: tier.iconUrl ?? '',
    isActive: tier.isActive,
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
    const payload = {
      name: form.value.name.trim(),
      level: Number(form.value.level),
      description: form.value.description.trim() || null,
      iconUrl: form.value.iconUrl.trim() || null,
      isActive: form.value.isActive,
    }

    if (editing.value) {
      await updateTier(editing.value.id, payload)
      toast.success(t('tiers.updated'))
    } else {
      await createTier(payload)
      toast.success(t('tiers.created'))
    }

    modalOpen.value = false
    await tiers.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function toggleActive(tier: MembershipTier): Promise<void> {
  try {
    await updateTier(tier.id, { isActive: !tier.isActive })
    toast.success(t('tiers.updated'))
    await tiers.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('tiers.title')" :subtitle="$t('tiers.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.MembershipTiersCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('tiers.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <BaseTable
        :columns="columns"
        :rows="ordered"
        row-key="id"
        :loading="tiers.loading.value"
        :refreshing="tiers.refreshing.value"
        :error="tiers.error.value"
        :empty-title="$t('tiers.empty')"
        :empty-body="$t('tiers.emptyHint')"
        @retry="tiers.refresh()"
      >
        <template #cell:level="{ row }">
          <BaseBadge variant="primary">{{ fmt.number(row.level) }}</BaseBadge>
        </template>

        <template #cell:name="{ row }">
          <div class="flex items-center gap-2.5">
            <!--
              `v-if` on the URL keeps the no-icon row unchanged; `@error` covers
              a URL that exists but the browser cannot load.
            -->
            <img
              v-if="row.iconUrl && !failedIcons.has(row.id)"
              :src="resolveAssetUrl(row.iconUrl)!"
              alt=""
              class="size-7 shrink-0 rounded-lg object-cover"
              loading="lazy"
              @error="failedIcons.add(row.id)"
            />
            <span class="font-medium">{{ row.name }}</span>
          </div>
        </template>

        <template #cell:description="{ row }">
          <span class="line-clamp-1 text-content-muted">{{ row.description ?? '—' }}</span>
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
              v-if="can(P.MembershipTiersUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.MembershipTiersUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.MembershipTiersCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('tiers.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <p class="text-xs text-content-subtle">{{ $t('tiers.noDeleteNote') }}</p>
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('tiers.editTitle') : $t('tiers.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.name"
          :label="$t('common.name')"
          :errors="fieldErrors.name"
          :maxlength="64"
          required
        />
        <BaseInput
          v-model="form.level"
          type="number"
          inputmode="numeric"
          min="1"
          :label="$t('tiers.level')"
          :hint="$t('tiers.levelHint')"
          :errors="fieldErrors.level"
          dir="ltr"
          required
        />
        <BaseTextarea
          v-model="form.description"
          :label="$t('common.description')"
          :errors="fieldErrors.description"
          :maxlength="512"
        />
        <BaseInput
          v-model="form.iconUrl"
          :label="$t('tiers.icon')"
          :errors="fieldErrors.iconUrl"
          :maxlength="512"
          dir="ltr"
          placeholder="https://…"
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
