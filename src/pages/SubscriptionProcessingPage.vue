<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, Send, TriangleAlert } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { processSubscription } from '@/api/subscriptions.api'
import { getConfiguration } from '@/api/settings.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { ProcessSubscriptionResponse } from '@/types/models'

/**
 * Subscription processing.
 *
 * Two rules from the API shape this screen:
 *
 *  1. Only `userId` and `price` are required. Every other field is optional and
 *     is recorded for traceability without affecting the award, so they live in
 *     a clearly separated optional section.
 *
 *  2. The endpoint is not idempotent. No duplicate detection is attempted on
 *     `subscriptionId` — that is the server's contract to define, not the
 *     dashboard's to work around. What the form does prevent is an *accidental*
 *     second submission, by disabling submit for the duration of the request.
 *
 * Points are never calculated here. The formula is shown for information only,
 * read from the live configuration endpoint.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

// Shown as context so an operator can see what the award will be based on.
// A caller without the configuration read permission simply sees generic text.
const configuration = can(P.LoyaltyConfigurationRead)
  ? useAsyncResource(() => getConfiguration(), { toastOnError: false })
  : null

const form = ref({
  userId: '',
  price: '',
  username: '',
  fullName: '',
  phoneNumber: '',
  subscriptionId: '',
  packageId: '',
  packageName: '',
  isMobileApp: false,
})

const submitting = ref(false)
const result = ref<ProcessSubscriptionResponse | null>(null)
const formError = ref<string | null>(null)
const serverFieldErrors = ref<Record<string, string[]>>({})
const localErrors = ref<Record<string, string[]>>({})

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Server messages win over local ones: the server is the authority. */
function errorsFor(field: string): string[] | undefined {
  return serverFieldErrors.value[field] ?? localErrors.value[field]
}

/**
 * Checks only the two required fields, and only for shape.
 *
 * Nothing here duplicates business logic — no point arithmetic, no package
 * lookup, no duplicate check. It exists to catch a typo before a round trip.
 */
function validate(): boolean {
  const errors: Record<string, string[]> = {}

  const userId = form.value.userId.trim()
  if (!userId) {
    errors.userId = [t('subscriptions.validation.userIdRequired')]
  } else if (!GUID_PATTERN.test(userId)) {
    errors.userId = [t('subscriptions.validation.userIdInvalid')]
  }

  const price = form.value.price.trim()
  if (!price) {
    errors.price = [t('subscriptions.validation.priceRequired')]
  } else if (!Number.isFinite(Number(price))) {
    errors.price = [t('subscriptions.validation.priceInvalid')]
  } else if (Number(price) < 0) {
    errors.price = [t('subscriptions.validation.priceNegative')]
  }

  localErrors.value = errors
  return Object.keys(errors).length === 0
}

/** Blank optional fields are omitted rather than sent as empty strings. */
function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function submit(): Promise<void> {
  // The guard that actually prevents a double award from one double-click.
  if (submitting.value) return

  formError.value = null
  serverFieldErrors.value = {}
  if (!validate()) return

  submitting.value = true
  try {
    result.value = await processSubscription({
      userId: form.value.userId.trim(),
      price: Number(form.value.price),
      username: optional(form.value.username),
      fullName: optional(form.value.fullName),
      phoneNumber: optional(form.value.phoneNumber),
      subscriptionId: optional(form.value.subscriptionId),
      packageId: optional(form.value.packageId),
      packageName: optional(form.value.packageName),
      // Only sent when switched on, so an untouched form carries no opinion.
      isMobileApp: form.value.isMobileApp ? true : undefined,
    })

    toast.success(t('subscriptions.success'))
  } catch (error) {
    serverFieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    submitting.value = false
  }
}

function reset(): void {
  form.value = {
    userId: '',
    price: '',
    username: '',
    fullName: '',
    phoneNumber: '',
    subscriptionId: '',
    packageId: '',
    packageName: '',
    isMobileApp: false,
  }
  result.value = null
  formError.value = null
  serverFieldErrors.value = {}
  localErrors.value = {}
}

const formulaNote = computed(() => {
  const config = configuration?.data.value
  if (!config) return t('subscriptions.formulaNoteGeneric')
  return t('subscriptions.formulaNote', {
    threshold: fmt.number(config.amountIqd),
    points: fmt.number(config.points),
  })
})

const awardedNothing = computed(() => result.value !== null && result.value.pointsEarned === 0)
</script>

<template>
  <div>
    <PageHeader :title="$t('subscriptions.title')" :subtitle="$t('subscriptions.subtitle')" />

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <!--
          The non-idempotency warning is placed above the form, not beside the
          submit button, so it is read before any data is entered.
        -->
        <BaseAlert variant="warning" class="mb-4">
          <span class="font-semibold">{{ $t('subscriptions.idempotencyWarningTitle') }}</span>
          {{ ' ' }}{{ $t('subscriptions.idempotencyWarning') }}
        </BaseAlert>

        <BaseCard>
          <form class="space-y-5" novalidate @submit.prevent="submit">
            <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

            <!-- Required -->
            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-model="form.userId"
                :label="$t('subscriptions.userId')"
                :hint="$t('subscriptions.userIdHint')"
                :errors="errorsFor('userId')"
                placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                dir="ltr"
                monospace
                required
              />
              <BaseInput
                v-model="form.price"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                :label="$t('subscriptions.price')"
                :hint="$t('subscriptions.priceHint')"
                :errors="errorsFor('price')"
                placeholder="100000"
                dir="ltr"
                required
              />
            </div>

            <!-- Optional -->
            <div class="border-t border-hairline pt-5">
              <div class="mb-4">
                <h3 class="flex items-center gap-2 text-sm font-semibold text-content">
                  {{ $t('subscriptions.optionalSection') }}
                  <BaseBadge size="sm">{{ $t('common.optional') }}</BaseBadge>
                </h3>
                <p class="mt-1 text-xs text-content-muted">
                  {{ $t('subscriptions.optionalSectionHint') }}
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <BaseInput
                  v-model="form.username"
                  :label="$t('subscriptions.username')"
                  :errors="errorsFor('username')"
                  :maxlength="256"
                  autocomplete="off"
                />
                <BaseInput
                  v-model="form.fullName"
                  :label="$t('subscriptions.fullName')"
                  :errors="errorsFor('fullName')"
                  :maxlength="256"
                  autocomplete="off"
                />
                <BaseInput
                  v-model="form.phoneNumber"
                  type="tel"
                  inputmode="tel"
                  :label="$t('subscriptions.phoneNumber')"
                  :errors="errorsFor('phoneNumber')"
                  :maxlength="32"
                  dir="ltr"
                  autocomplete="off"
                />
                <BaseInput
                  v-model="form.subscriptionId"
                  :label="$t('subscriptions.subscriptionId')"
                  :errors="errorsFor('subscriptionId')"
                  :maxlength="128"
                  dir="ltr"
                  autocomplete="off"
                />
                <BaseInput
                  v-model="form.packageId"
                  :label="$t('subscriptions.packageId')"
                  :errors="errorsFor('packageId')"
                  :maxlength="128"
                  dir="ltr"
                  autocomplete="off"
                />
                <BaseInput
                  v-model="form.packageName"
                  :label="$t('subscriptions.packageName')"
                  :errors="errorsFor('packageName')"
                  :maxlength="256"
                  autocomplete="off"
                />
              </div>

              <div class="mt-4">
                <BaseToggle
                  v-model="form.isMobileApp"
                  :label="$t('subscriptions.isMobileApp')"
                  :hint="$t('subscriptions.isMobileAppHint')"
                />
              </div>
            </div>

            <div class="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
              <BaseButton variant="secondary" :disabled="submitting" @click="reset">
                {{ $t('common.reset') }}
              </BaseButton>
              <BaseButton type="submit" variant="primary" :loading="submitting">
                <template #icon><Send class="size-4 rtl:-scale-x-100" /></template>
                {{ submitting ? $t('subscriptions.processing') : $t('subscriptions.process') }}
              </BaseButton>
            </div>
          </form>
        </BaseCard>
      </div>

      <!-- Result and context -->
      <div class="space-y-4">
        <BaseCard v-if="result" :title="$t('subscriptions.resultTitle')">
          <div v-if="awardedNothing">
            <BaseAlert variant="info" :title="$t('subscriptions.zeroPointsTitle')">
              {{ $t('subscriptions.zeroPointsBody') }}
            </BaseAlert>
          </div>

          <div v-else class="flex items-center gap-3 rounded-xl bg-success-50 p-4 dark:bg-success-500/10">
            <CircleCheck class="size-8 shrink-0 text-success-600" aria-hidden="true" />
            <div class="min-w-0">
              <p class="text-xs font-medium text-success-700 dark:text-success-500">
                {{ $t('subscriptions.pointsEarned') }}
              </p>
              <p class="text-2xl font-semibold tabular-nums text-success-700 dark:text-success-500">
                +{{ fmt.points(result.pointsEarned) }}
              </p>
            </div>
          </div>

          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('subscriptions.totalPoints') }}</dt>
              <dd class="font-semibold tabular-nums text-content">
                {{ fmt.points(result.totalPoints) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('subscriptions.rank') }}</dt>
              <dd>
                <BaseBadge v-if="result.rank" variant="primary">{{ result.rank.name }}</BaseBadge>
                <span v-else class="text-content-subtle">{{ $t('common.notAvailable') }}</span>
              </dd>
            </div>
            <div v-if="result.subscriptionId" class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('subscriptions.subscriptionId') }}</dt>
              <dd class="truncate font-mono text-xs text-content" dir="ltr">
                {{ result.subscriptionId }}
              </dd>
            </div>
          </dl>

          <template #footer>
            <BaseButton variant="secondary" size="sm" block @click="reset">
              {{ $t('subscriptions.processAnother') }}
            </BaseButton>
          </template>
        </BaseCard>

        <BaseCard :title="$t('settings.formula')">
          <p class="text-sm leading-relaxed text-content-muted">{{ formulaNote }}</p>
          <div
            v-if="configuration?.data.value"
            class="mt-3 rounded-lg bg-surface-muted px-3 py-2.5 text-center font-mono text-xs text-content"
            dir="ltr"
          >
            floor(price ÷ {{ configuration.data.value.amountIqd }})
            × {{ configuration.data.value.points }}
          </div>
          <p class="mt-3 flex gap-2 text-xs text-content-subtle">
            <TriangleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{{ $t('packages.legacyNote') }}</span>
          </p>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
