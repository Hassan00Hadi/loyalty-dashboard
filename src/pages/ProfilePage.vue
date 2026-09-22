<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KeyRound } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { changeOwnPassword } from '@/api/auth.api'
import { useApiError } from '@/composables/useApiError'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

/**
 * The caller's own account.
 *
 * The only mutation the API offers here is a password change, and succeeding at
 * it invalidates the current token — so the user is signed out and returned to
 * the login screen rather than left holding a token the server has rejected.
 */
const { t, te } = useI18n()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const { messageFor, fieldErrorsOf } = useApiError()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const localError = ref<string | null>(null)

/** Grouped so a long permission list stays scannable. */
const permissionGroups = computed(() => {
  const map = new Map<string, string[]>()
  for (const permission of auth.permissions) {
    const [group] = permission.split('.')
    const existing = map.get(group)
    if (existing) existing.push(permission)
    else map.set(group, [permission])
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      label: te(`permissions.groups.${key}`) ? t(`permissions.groups.${key}`) : key,
      items: items.sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const canSubmit = computed(
  () =>
    currentPassword.value.length > 0 &&
    newPassword.value.length > 0 &&
    confirmPassword.value.length > 0 &&
    !saving.value,
)

async function submit(): Promise<void> {
  if (saving.value) return

  formError.value = null
  localError.value = null
  fieldErrors.value = {}

  // Confirmation is a UI-only concern; the API takes a single new password.
  if (newPassword.value !== confirmPassword.value) {
    localError.value = t('auth.passwordMismatch')
    return
  }
  if (newPassword.value.length < 12) {
    localError.value = t('auth.passwordTooShort')
    return
  }

  saving.value = true
  try {
    await changeOwnPassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })

    toast.success(t('auth.passwordChanged'))
    // The token that made this request is now void, so the session ends here.
    auth.logout()
    await router.push({ name: 'login' })
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('nav.profile')" :subtitle="auth.admin?.email" />

    <div class="grid gap-5 lg:grid-cols-3">
      <!-- Identity -->
      <BaseCard class="lg:col-span-1">
        <div class="flex items-center gap-3">
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-600
                   text-base font-semibold text-white"
            aria-hidden="true"
          >
            {{ auth.initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-semibold text-content">{{ auth.fullName }}</p>
            <p class="truncate text-sm text-content-muted" dir="ltr">{{ auth.admin?.email }}</p>
          </div>
        </div>

        <div class="mt-5">
          <p class="mb-1.5 text-xs font-medium text-content-muted">{{ $t('auth.myRoles') }}</p>
          <div v-if="auth.roleNames.length" class="flex flex-wrap gap-1.5">
            <BaseBadge v-for="role in auth.roleNames" :key="role" variant="primary">
              {{ role }}
            </BaseBadge>
          </div>
          <p v-else class="text-sm text-content-subtle">{{ $t('admins.noRoles') }}</p>
        </div>

        <div class="mt-4">
          <p class="text-xs font-medium text-content-muted">
            {{ $t('auth.myPermissions') }}
            <span class="ms-1 text-content-subtle">({{ auth.permissions.size }})</span>
          </p>
        </div>
      </BaseCard>

      <!-- Password -->
      <BaseCard class="lg:col-span-2" :title="$t('auth.changePassword')">
        <form class="space-y-4" novalidate @submit.prevent="submit">
          <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>
          <BaseAlert v-else-if="localError" variant="warning">{{ localError }}</BaseAlert>

          <BaseInput
            v-model="currentPassword"
            type="password"
            :label="$t('auth.currentPassword')"
            :errors="fieldErrors.currentPassword"
            autocomplete="current-password"
            required
          />
          <BaseInput
            v-model="newPassword"
            type="password"
            :label="$t('auth.newPassword')"
            :hint="$t('admins.passwordHint')"
            :errors="fieldErrors.newPassword"
            autocomplete="new-password"
            required
          />
          <BaseInput
            v-model="confirmPassword"
            type="password"
            :label="$t('auth.confirmPassword')"
            autocomplete="new-password"
            required
          />

          <!-- Sets the expectation before submitting: this ends the session. -->
          <BaseAlert variant="info">{{ $t('admins.passwordResetHint') }}</BaseAlert>

          <div class="flex justify-end border-t border-hairline pt-4">
            <BaseButton type="submit" variant="primary" :loading="saving" :disabled="!canSubmit">
              <template #icon><KeyRound class="size-4" /></template>
              {{ $t('auth.changePassword') }}
            </BaseButton>
          </div>
        </form>
      </BaseCard>

      <!-- Effective permissions -->
      <BaseCard class="lg:col-span-3" :title="$t('auth.myPermissions')">
        <div v-if="permissionGroups.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="group in permissionGroups"
            :key="group.key"
            class="rounded-xl border border-hairline bg-surface-muted/40 p-3"
          >
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content">
              {{ group.label }}
            </p>
            <ul class="space-y-0.5">
              <li
                v-for="permission in group.items"
                :key="permission"
                class="truncate font-mono text-[0.6875rem] text-content-muted"
                dir="ltr"
              >
                {{ permission }}
              </li>
            </ul>
          </div>
        </div>
        <p v-else class="text-sm text-content-muted">{{ $t('admins.noRolesWarning') }}</p>
      </BaseCard>
    </div>
  </div>
</template>
