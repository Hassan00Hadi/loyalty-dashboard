<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Lock, Plus, Settings2 } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import PermissionPicker from '@/components/forms/PermissionPicker.vue'
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  replaceRolePermissions,
  updateRole,
} from '@/api/roles.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { Role } from '@/types/models'

/**
 * Roles and their permission sets.
 *
 * A system role (SuperAdmin) cannot be deleted, which the row reflects by
 * omitting the delete action rather than letting it fail. Permission assignment
 * is wholesale, as the API requires.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const roles = useAsyncResource(() => listRoles(), {
  errorTitleKey: 'errors.loadRolesFailed',
  toastOnError: false,
})

const permissions = can(P.PermissionsRead)
  ? useAsyncResource(() => listPermissions(), { toastOnError: false })
  : null

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('roles.role') },
  { key: 'permissions', label: t('roles.permissionCount'), align: 'end', hideBelow: 'sm' },
  { key: 'adminCount', label: t('roles.adminCount'), align: 'end', hideBelow: 'md' },
  { key: 'createdAt', label: t('common.createdAt'), hideBelow: 'xl' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<Role | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({ name: '', description: '', permissionIds: [] as string[] })

function openCreate(): void {
  editing.value = null
  form.value = { name: '', description: '', permissionIds: [] }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(role: Role): void {
  editing.value = role
  form.value = {
    name: role.name,
    description: role.description ?? '',
    permissionIds: role.permissions.map((permission) => permission.id),
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
      // The update contract covers name and description only; permissions have
      // their own endpoint and their own dialog.
      await updateRole(editing.value.id, {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
      })
      toast.success(t('roles.updated'))
    } else {
      await createRole({
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        permissionIds: form.value.permissionIds,
      })
      toast.success(t('roles.created'))
    }

    modalOpen.value = false
    await roles.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function remove(role: Role): Promise<void> {
  const confirmed = await confirm({
    title: t('roles.deleteConfirmTitle'),
    body: t('roles.deleteConfirmBody', { name: role.name }),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteRole(role.id)
    toast.success(t('roles.deleted'))
    await roles.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

// ── Permission assignment ─────────────────────────────────────────────────────

const permissionsModalOpen = ref(false)
const permissionTarget = ref<Role | null>(null)
const selectedPermissionIds = ref<string[]>([])
const savingPermissions = ref(false)

function openPermissions(role: Role): void {
  permissionTarget.value = role
  selectedPermissionIds.value = role.permissions.map((permission) => permission.id)
  permissionsModalOpen.value = true
}

async function savePermissions(): Promise<void> {
  if (!permissionTarget.value || savingPermissions.value) return

  savingPermissions.value = true
  try {
    await replaceRolePermissions(permissionTarget.value.id, selectedPermissionIds.value)
    toast.success(t('roles.permissionsUpdated'))
    permissionsModalOpen.value = false
    await roles.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  } finally {
    savingPermissions.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('roles.title')" :subtitle="$t('roles.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.RolesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('roles.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <BaseTable
        :columns="columns"
        :rows="roles.data.value ?? []"
        row-key="id"
        :loading="roles.loading.value"
        :refreshing="roles.refreshing.value"
        :error="roles.error.value"
        :empty-title="$t('roles.empty')"
        :empty-body="$t('roles.emptyHint')"
        @retry="roles.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="truncate font-medium">{{ row.name }}</span>
              <BaseBadge v-if="row.isSystemRole" variant="info" size="sm">
                <Lock class="size-2.5" aria-hidden="true" />
                {{ $t('roles.systemRole') }}
              </BaseBadge>
            </div>
            <p v-if="row.description" class="truncate text-xs text-content-muted">
              {{ row.description }}
            </p>
          </div>
        </template>

        <template #cell:permissions="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.permissions.length) }}</span>
        </template>

        <template #cell:adminCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.adminCount) }}</span>
        </template>

        <template #cell:createdAt="{ row }">
          <span class="text-content-muted">{{ fmt.date(row.createdAt) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.RolesManagePermissions)"
              variant="ghost"
              size="sm"
              icon-only
              :label="$t('roles.managePermissions')"
              @click="openPermissions(row)"
            >
              <template #icon><Settings2 class="size-4" /></template>
            </BaseButton>
            <BaseButton
              v-if="can(P.RolesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <!-- Absent for a system role: the API refuses, so the action is not offered. -->
            <BaseButton
              v-if="can(P.RolesDelete) && !row.isSystemRole"
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
          <BaseButton v-if="can(P.RolesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('roles.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <p class="text-xs text-content-subtle">{{ $t('roles.systemRoleLocked') }}</p>
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :size="editing ? 'md' : 'xl'"
      :title="editing ? $t('roles.editTitle') : $t('roles.createTitle')"
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
        <BaseTextarea
          v-model="form.description"
          :label="$t('common.description')"
          :errors="fieldErrors.description"
          :maxlength="512"
        />

        <div v-if="!editing && permissions?.data.value?.length" class="border-t border-hairline pt-4">
          <PermissionPicker
            v-model="form.permissionIds"
            :permissions="permissions.data.value"
          />
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

    <BaseModal
      :open="permissionsModalOpen"
      size="xl"
      :title="$t('roles.managePermissionsTitle', { name: permissionTarget?.name ?? '' })"
      @close="permissionsModalOpen = false"
    >
      <p class="mb-3 text-xs text-content-muted">{{ $t('roles.permissionsReplaceNote') }}</p>
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
