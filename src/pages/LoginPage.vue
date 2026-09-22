<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, Globe, LogIn } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BrandLogo from '@/components/layout/BrandLogo.vue'
import { useApiError } from '@/composables/useApiError'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { setI18nLocale } from '@/i18n'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const { messageFor, fieldErrorsOf } = useApiError()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const canSubmit = computed(
  () => email.value.trim().length > 0 && password.value.length > 0 && !submitting.value,
)

function toggleLocale(): void {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  ui.setLocale(next)
  setI18nLocale(next)
}

async function submit(): Promise<void> {
  if (submitting.value) return

  submitting.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    await auth.login({ email: email.value.trim(), password: password.value })

    // Returns to whatever the guard interrupted, defaulting to the dashboard.
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' ? redirect : { name: 'dashboard' })
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    // A 401 here means bad credentials rather than an expired session, so the
    // generic "please sign in again" wording would be confusing.
    const normalised = error as { status?: number | null }
    formError.value =
      normalised.status === 401 ? t('auth.invalidCredentials') : messageFor(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-canvas">
    <!-- Brand wash: a single soft tint rather than a heavy gradient. -->
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgb(74_43_140_/_0.10),transparent)]
             dark:bg-[radial-gradient(70%_55%_at_50%_0%,rgb(74_43_140_/_0.28),transparent)]"
      aria-hidden="true"
    />

    <header class="relative flex items-center justify-between px-4 py-4 sm:px-6">
      <BrandLogo :height="26" />
      <BaseButton variant="ghost" size="sm" @click="toggleLocale">
        <template #icon><Globe class="size-4" /></template>
        {{ locale === 'ar' ? 'English' : 'العربية' }}
      </BaseButton>
    </header>

    <main class="relative flex flex-1 items-center justify-center px-4 py-8">
      <div class="w-full max-w-[26rem]">
        <div class="mb-7 text-center">
          <h1 class="text-2xl font-semibold tracking-tight text-content">
            {{ $t('auth.welcomeTitle') }}
          </h1>
          <p class="mt-2 text-sm text-content-muted">{{ $t('auth.welcomeSubtitle') }}</p>
        </div>

        <div class="card-base p-5 sm:p-6">
          <form class="space-y-4" novalidate @submit.prevent="submit">
            <BaseAlert v-if="formError" variant="error" :title="$t('auth.loginFailed')">
              {{ formError }}
            </BaseAlert>

            <BaseInput
              v-model="email"
              type="email"
              :label="$t('auth.email')"
              :placeholder="$t('auth.emailPlaceholder')"
              :errors="fieldErrors.email"
              autocomplete="username"
              inputmode="email"
              dir="ltr"
              required
            />

            <div class="relative">
              <BaseInput
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :label="$t('auth.password')"
                :placeholder="$t('auth.passwordPlaceholder')"
                :errors="fieldErrors.password"
                autocomplete="current-password"
                required
              />
              <!-- Offset clears the label row above the field. -->
              <button
                type="button"
                class="absolute end-2 top-[1.9rem] rounded p-1.5 text-content-subtle transition
                       hover:bg-surface-muted hover:text-content"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="size-4" aria-hidden="true" />
                <Eye v-else class="size-4" aria-hidden="true" />
              </button>
            </div>

            <BaseButton
              type="submit"
              variant="primary"
              size="lg"
              block
              :loading="submitting"
              :disabled="!canSubmit"
            >
              <template #icon><LogIn class="size-4 rtl:rotate-180" /></template>
              {{ submitting ? $t('auth.signingIn') : $t('auth.signIn') }}
            </BaseButton>
          </form>
        </div>

        <p class="mt-6 text-center text-xs text-content-subtle">{{ $t('auth.footerNote') }}</p>
      </div>
    </main>
  </div>
</template>
