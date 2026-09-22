<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Ban, KeyRound, Plus, Settings2 } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import CopyButton from '@/components/ui/CopyButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import PermissionPicker from '@/components/forms/PermissionPicker.vue'
import {
  createClient,
  deleteClient,
  listClients,
  replaceClientPermissions,
  revokeClient,
  updateClient,
} from '@/api/clients.api'
import { listPermissions } from '@/api/roles.api'
import { listMerchants } from '@/api/catalog.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { ApiClient, ClientCreated } from '@/types/models'

/**
 * API clients — the credentials external systems authenticate with.
 *
 * The plaintext secret is returned exactly once, by the create call. It is shown
 * in a persistent dialog that must be dismissed deliberately, because no other
 * endpoint can ever return it again.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const clients = useAsyncResource(() => listClients(), {
  errorTitleKey: 'errors.loadClientsFailed',
  toastOnError: false,
})

const permissions = can(P.PermissionsRead)
  ? useAsyncResource(() => listPermissions(), { toastOnError: false })
  : null

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const merchantNames = computed(() => {
  const map = new Map<string, string>()
  for (const merchant of merchants?.data.value ?? []) map.set(merchant.id, merchant.name)
  return map
})

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('clients.client') },
  { key: 'keyPrefix', label: t('clients.keyPrefix'), mono: true, hideBelow: 'sm' },
  { key: 'merchantId', label: t('clients.merchant'), hideBelow: 'lg' },
  { key: 'status', label: t('common.status') },
  { key: 'lastUsedAt', label: t('clients.lastUsed'), hideBelow: 'xl' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<ApiClient | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  name: '',
  description: '',
  contactEmail: '',
  merchantId: null as string | null,
  expiresAt: '',
  isActive: true,
  permissionIds: [] as string[],
})

function openCreate(): void {
  editing.value = null
  form.value = {
    name: '',
    description: '',
    contactEmail: '',
    merchantId: null,
    expiresAt: '',
    isActive: true,
    permissionIds: [],
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(client: ApiClient): void {
  editing.value = client
  form.value = {
    name: client.name,
    description: client.description ?? '',
    contactEmail: client.contactEmail ?? '',
    merchantId: client.merchantId,
    // `datetime-local` needs `YYYY-MM-DDTHH:mm`, so the seconds and zone go.
    expiresAt: client.expiresAt ? client.expiresAt.slice(0, 16) : '',
    isActive: client.isActive,
    permissionIds: client.permissions.map((permission) => permission.id),
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

/** The one-time secret, held only until the administrator dismisses it. */
const createdSecret = ref<ClientCreated | null>(null)

async function save(): Promise<void> {
  if (saving.value) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    const expiresAt = form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null

    if (editing.value) {
      await updateClient(editing.value.id, {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        contactEmail: form.value.contactEmail.trim() || null,
        merchantId: form.value.merchantId,
        expiresAt,
        isActive: form.value.isActive,
      })
      toast.success(t('clients.updated'))
      modalOpen.value = false
    } else {
      const created = await createClient({
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        contactEmail: form.value.contactEmail.trim() || null,
        merchantId: form.value.merchantId,
        expiresAt,
        permissionIds: form.value.permissionIds,
      })
      modalOpen.value = false
      // Shown before anything else can navigate away from it.
      createdSecret.value = created
      toast.success(t('clients.created'))
    }

    await clients.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function revoke(client: ApiClient): Promise<void> {
  const confirmed = await confirm({
    title: t('clients.revokeConfirmTitle'),
    body: t('clients.revokeConfirmBody'),
    confirmLabel: t('clients.revokeAction'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await revokeClient(client.id)
    toast.success(t('clients.revokedToast'))
    await clients.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}

async function remove(client: ApiClient): Promise<void> {
  const confirmed = await confirm({
    title: t('clients.deleteConfirmTitle'),
    body: t('clients.deleteConfirmBody', { name: client.name }),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteClient(client.id)
    toast.success(t('clients.deleted'))
    await clients.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

// ── Permission assignment ─────────────────────────────────────────────────────

const permissionsModalOpen = ref(false)
const permissionTarget = ref<ApiClient | null>(null)
const selectedPermissionIds = ref<string[]>([])
const savingPermissions = ref(false)

function openPermissions(client: ApiClient): void {
  permissionTarget.value = client
  selectedPermissionIds.value = client.permissions.map((permission) => permission.id)
  permissionsModalOpen.value = true
}

async function savePermissions(): Promise<void> {
  if (!permissionTarget.value || savingPermissions.value) return

  savingPermissions.value = true
  try {
    await replaceClientPermissions(permissionTarget.value.id, selectedPermissionIds.value)
    toast.success(t('clients.permissionsUpdated'))
    permissionsModalOpen.value = false
    await clients.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  } finally {
    savingPermissions.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('clients.title')" :subtitle="$t('clients.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.ClientsCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('clients.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <BaseTable
        :columns="columns"
        :rows="clients.data.value ?? []"
        row-key="id"
        :loading="clients.loading.value"
        :refreshing="clients.refreshing.value"
        :error="clients.error.value"
        :empty-title="$t('clients.empty')"
        :empty-body="$t('clients.emptyHint')"
        @retry="clients.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.name }}</p>
            <p v-if="row.description" class="truncate text-xs text-content-muted">
              {{ row.description }}
            </p>
          </div>
        </template>

        <template #cell:keyPrefix="{ row }">
          <span class="text-content-muted" dir="ltr">{{ row.keyPrefix }}…</span>
        </template>

        <template #cell:merchantId="{ row }">
          <span v-if="row.merchantId" class="text-content-muted">
            {{ merchantNames.get(row.merchantId) ?? fmt.shortId(row.merchantId) }}
          </span>
          <span v-else class="text-xs text-content-subtle">{{ $t('clients.noMerchant') }}</span>
        </template>

        <template #cell:status="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <BaseBadge v-if="row.revokedAt" variant="danger" dot>
              {{ $t('clients.revoked') }}
            </BaseBadge>
            <StatusBadge v-else :active="row.isActive" />
          </div>
        </template>

        <template #cell:lastUsedAt="{ row }">
          <span class="text-content-muted">
            {{ row.lastUsedAt ? fmt.dateTime(row.lastUsedAt) : $t('clients.neverUsed') }}
          </span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.ClientsManagePermissions)"
              variant="ghost"
              size="sm"
              icon-only
              :label="$t('clients.managePermissions')"
              @click="openPermissions(row)"
            >
              <template #icon><Settings2 class="size-4" /></template>
            </BaseButton>
            <BaseButton
              v-if="can(P.ClientsRevoke) && !row.revokedAt"
              variant="ghost"
              size="sm"
              icon-only
              :label="$t('clients.revokeAction')"
              class="text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-500/10"
              @click="revoke(row)"
            >
              <template #icon><Ban class="size-4" /></template>
            </BaseButton>
            <BaseButton
              v-if="can(P.ClientsUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.ClientsDelete)"
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
          <BaseButton v-if="can(P.ClientsCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('clients.create') }}
          </BaseButton>
        </template>
      </BaseTable>
    </BaseCard>

    <!-- Create / edit -->
    <BaseModal
      :open="modalOpen"
      :size="editing ? 'md' : 'xl'"
      :title="editing ? $t('clients.editTitle') : $t('clients.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.name"
          :label="$t('common.name')"
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

        <BaseInput
          v-model="form.contactEmail"
          type="email"
          :label="$t('clients.contactEmail')"
          :hint="$t('clients.contactEmailHint')"
          :errors="fieldErrors.contactEmail"
          :maxlength="256"
          dir="ltr"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="form.merchantId"
            :options="merchantOptions"
            :label="$t('clients.merchant')"
            :hint="$t('clients.merchantHint')"
            :placeholder="$t('clients.noMerchant')"
            :errors="fieldErrors.merchantId"
          />
          <BaseInput
            v-model="form.expiresAt"
            type="datetime-local"
            :label="$t('clients.expiresAt')"
            :errors="fieldErrors.expiresAt"
            dir="ltr"
          />
        </div>

        <BaseToggle v-if="editing" v-model="form.isActive" :label="$t('common.active')" />

        <div v-if="!editing && permissions?.data.value?.length" class="border-t border-hairline pt-4">
          <PermissionPicker v-model="form.permissionIds" :permissions="permissions.data.value" />
        </div>
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

    <!--
      The one-time secret. `persistent` so it cannot be dismissed by a stray
      backdrop click before the key has been copied.
    -->
    <BaseModal
      :open="createdSecret !== null"
      :title="$t('clients.secretTitle')"
      size="md"
      persistent
      @close="createdSecret = null"
    >
      <BaseAlert variant="warning" class="mb-4">{{ $t('clients.secretBody') }}</BaseAlert>

      <div v-if="createdSecret">
        <p class="mb-1.5 text-sm font-medium text-content">{{ $t('clients.secretLabel') }}</p>
        <div class="flex items-center gap-2 rounded-lg border border-hairline bg-surface-muted p-3">
          <code class="min-w-0 flex-1 break-all font-mono text-xs text-content" dir="ltr">
            {{ createdSecret.secretKey }}
          </code>
          <CopyButton :value="createdSecret.secretKey" size="md" />
        </div>

        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-content-muted">{{ $t('common.name') }}</dt>
            <dd class="font-medium text-content">{{ createdSecret.name }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-content-muted">{{ $t('clients.keyPrefix') }}</dt>
            <dd class="font-mono text-xs text-content" dir="ltr">{{ createdSecret.keyPrefix }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-content-muted">{{ $t('roles.permissionCount') }}</dt>
            <dd class="tabular-nums text-content">{{ createdSecret.permissions.length }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <BaseButton variant="primary" block @click="createdSecret = null">
          <template #icon><KeyRound class="size-4" /></template>
          {{ $t('clients.secretAcknowledge') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Permission assignment -->
    <BaseModal
      :open="permissionsModalOpen"
      size="xl"
      :title="$t('clients.managePermissionsTitle', { name: permissionTarget?.name ?? '' })"
      @close="permissionsModalOpen = false"
    >
      <PermissionPicker
        v-model="selectedPermissionIds"
        :permissions="permissions?.data.value ?? []"
      />

      <template #footer>
        <BaseButton
          variant="secondary"
          :disabled="savingPermissions"
          @click="permissionsModalOpen = false"
        >
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="primary" :loading="savingPermissions" @click="savePermissions">
          {{ $t('common.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
