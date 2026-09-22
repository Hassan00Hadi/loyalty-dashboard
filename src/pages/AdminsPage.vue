<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, ShieldCheck } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  replaceAdminRoles,
  updateAdmin,
} from '@/api/admins.api'
import { listRoles } from '@/api/roles.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePagedResource } from '@/composables/usePagedResource'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { Admin } from '@/types/models'

/**
 * Administrator accounts.
 *
 * Server-paged. DELETE deactivates rather than erasing, which the confirmation
 * wording reflects. Role assignment is a wholesale replacement, so the dialog
 * submits the complete intended set.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const admins = usePagedResource((query) => listAdmins(query), {
  errorTitleKey: 'errors.loadAdminsFailed',
})

const roles = can(P.RolesRead)
  ? useAsyncResource(() => listRoles(), { toastOnError: false })
  : null

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admins.admin') },
  { key: 'roles', label: t('admins.roles'), hideBelow: 'md' },
  { key: 'isActive', label: t('common.status') },
  { key: 'lastLoginAt', label: t('admins.lastLogin'), hideBelow: 'lg' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<Admin | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  isActive: true,
  roleIds: [] as string[],
})

function openCreate(): void {
  editing.value = null
  form.value = {
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    isActive: true,
    roleIds: [],
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(admin: Admin): void {
  editing.value = admin
  form.value = {
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    // Always blank on edit: a password is set, never read back.
    password: '',
    isActive: admin.isActive,
    roleIds: admin.roles.map((role) => role.id),
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
      await updateAdmin(editing.value.id, {
        email: form.value.email.trim(),
        firstName: form.value.firstName.trim(),
        lastName: form.value.lastName.trim(),
        isActive: form.value.isActive,
        // Omitted unless deliberately set, so saving other fields does not
        // silently rotate the target admin's password and sign them out.
        password: form.value.password.trim() || null,
      })
      toast.success(t('admins.updated'))
    } else {
      await createAdmin({
        email: form.value.email.trim(),
        password: form.value.password,
        firstName: form.value.firstName.trim(),
        lastName: form.value.lastName.trim(),
        isActive: form.value.isActive,
        roleIds: form.value.roleIds,
      })
      toast.success(t('admins.created'))
    }

    modalOpen.value = false
    await admins.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function deactivate(admin: Admin): Promise<void> {
  const confirmed = await confirm({
    title: t('admins.deactivateConfirmTitle'),
    body: t('admins.deactivateConfirmBody', {
      name: `${admin.firstName} ${admin.lastName}`.trim() || admin.email,
    }),
    confirmLabel: t('common.deactivate'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteAdmin(admin.id)
    toast.success(t('admins.deactivated'))
    await admins.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

// ── Role assignment ───────────────────────────────────────────────────────────

const rolesModalOpen = ref(false)
const rolesTarget = ref<Admin | null>(null)
const selectedRoleIds = ref<string[]>([])
const savingRoles = ref(false)

function openRoles(admin: Admin): void {
  rolesTarget.value = admin
  selectedRoleIds.value = admin.roles.map((role) => role.id)
  rolesModalOpen.value = true
}

function toggleRole(roleId: string): void {
  selectedRoleIds.value = selectedRoleIds.value.includes(roleId)
    ? selectedRoleIds.value.filter((id) => id !== roleId)
    : [...selectedRoleIds.value, roleId]
}

async function saveRoles(): Promise<void> {
  if (!rolesTarget.value || savingRoles.value) return

  savingRoles.value = true
  try {
    await replaceAdminRoles(rolesTarget.value.id, selectedRoleIds.value)
    toast.success(t('admins.rolesUpdated'))
    rolesModalOpen.value = false
    await admins.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  } finally {
    savingRoles.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('admins.title')" :subtitle="$t('admins.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.AdminsCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('admins.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <BaseTable
        :columns="columns"
        :rows="admins.items.value"
        row-key="id"
        :loading="admins.loading.value"
        :refreshing="admins.refreshing.value"
        :error="admins.error.value"
        :empty-title="$t('admins.empty')"
        :empty-body="$t('admins.emptyHint')"
        @retry="admins.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="flex items-center gap-2.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600
                     text-[0.6875rem] font-semibold text-white"
              aria-hidden="true"
            >
              {{ (row.firstName[0] ?? '') + (row.lastName[0] ?? '') }}
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium">{{ row.firstName }} {{ row.lastName }}</p>
              <p class="truncate text-xs text-content-muted" dir="ltr">{{ row.email }}</p>
            </div>
          </div>
        </template>

        <template #cell:roles="{ row }">
          <div v-if="row.roles.length" class="flex flex-wrap gap-1">
            <BaseBadge v-for="role in row.roles" :key="role.id" variant="primary" size="sm">
              {{ role.name }}
            </BaseBadge>
          </div>
          <span v-else class="text-xs text-content-subtle">{{ $t('admins.noRoles') }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusBadge :active="row.isActive" />
            <BaseBadge v-if="row.isLockedOut" variant="warning" size="sm">
              {{ $t('admins.lockedOut') }}
            </BaseBadge>
          </div>
        </template>

        <template #cell:lastLoginAt="{ row }">
          <span class="text-content-muted">
            {{ row.lastLoginAt ? fmt.dateTime(row.lastLoginAt) : $t('admins.neverSignedIn') }}
          </span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.AdminsManageRoles)"
              variant="ghost"
              size="sm"
              icon-only
              :label="$t('admins.manageRoles')"
              @click="openRoles(row)"
            >
              <template #icon><ShieldCheck class="size-4" /></template>
            </BaseButton>
            <BaseButton
              v-if="can(P.AdminsUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.AdminsDelete) && row.isActive"
              variant="ghost"
              size="sm"
              class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
              @click="deactivate(row)"
            >
              {{ $t('common.deactivate') }}
            </BaseButton>
          </div>
        </template>
      </BaseTable>

      <template #footer>
        <BasePagination
          :page="admins.page.value"
          :page-size="admins.pageSize.value"
          :total-count="admins.totalCount.value"
          :total-pages="admins.totalPages.value"
          :has-next-page="admins.hasNextPage.value"
          :has-previous-page="admins.hasPreviousPage.value"
          :range-from="admins.rangeFrom.value"
          :range-to="admins.rangeTo.value"
          :disabled="admins.refreshing.value"
          class="-mx-4 -mb-3 border-t-0"
          @update:page="admins.goToPage"
          @update:page-size="admins.setPageSize"
        />
      </template>
    </BaseCard>

    <!-- Create / edit -->
    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('admins.editTitle') : $t('admins.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.email"
          type="email"
          :label="$t('admins.email')"
          :errors="fieldErrors.email"
          :maxlength="256"
          dir="ltr"
          autocomplete="off"
          required
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.firstName"
            :label="$t('admins.firstName')"
            :errors="fieldErrors.firstName"
            :maxlength="128"
            required
          />
          <BaseInput
            v-model="form.lastName"
            :label="$t('admins.lastName')"
            :errors="fieldErrors.lastName"
            :maxlength="128"
            required
          />
        </div>

        <BaseInput
          v-model="form.password"
          type="password"
          :label="$t('admins.password')"
          :hint="editing ? $t('admins.passwordResetHint') : $t('admins.passwordHint')"
          :errors="fieldErrors.password"
          :maxlength="128"
          autocomplete="new-password"
          :required="!editing"
        />

        <!-- Roles are assignable at creation; afterwards through the roles dialog. -->
        <fieldset v-if="!editing && roles?.data.value?.length">
          <legend class="mb-2 text-sm font-medium text-content">{{ $t('admins.roles') }}</legend>
          <div class="space-y-1.5">
            <label
              v-for="role in roles.data.value"
              :key="role.id"
              class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                :checked="form.roleIds.includes(role.id)"
                class="size-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
                @change="
                  form.roleIds = form.roleIds.includes(role.id)
                    ? form.roleIds.filter((id) => id !== role.id)
                    : [...form.roleIds, role.id]
                "
              />
              <span class="text-sm text-content">{{ role.name }}</span>
            </label>
          </div>
          <p v-if="form.roleIds.length === 0" class="mt-2 text-xs text-warning-600">
            {{ $t('admins.noRolesWarning') }}
          </p>
        </fieldset>

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

    <!-- Role assignment -->
    <BaseModal
      :open="rolesModalOpen"
      :title="
        $t('admins.manageRolesTitle', {
          name: rolesTarget ? `${rolesTarget.firstName} ${rolesTarget.lastName}`.trim() : '',
        })
      "
      @close="rolesModalOpen = false"
    >
      <p class="mb-3 text-xs text-content-muted">{{ $t('admins.rolesReplaceNote') }}</p>

      <div class="space-y-1.5">
        <label
          v-for="role in roles?.data.value ?? []"
          :key="role.id"
          class="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-muted"
        >
          <input
            type="checkbox"
            :checked="selectedRoleIds.includes(role.id)"
            class="mt-0.5 size-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
            @change="toggleRole(role.id)"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-content">{{ role.name }}</span>
            <span v-if="role.description" class="block text-xs text-content-muted">
              {{ role.description }}
            </span>
          </span>
        </label>
      </div>

      <p v-if="selectedRoleIds.length === 0" class="mt-3 text-xs text-warning-600">
        {{ $t('admins.noRolesWarning') }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="savingRoles" @click="rolesModalOpen = false">
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="primary" :loading="savingRoles" @click="saveRoles">
          {{ $t('common.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
