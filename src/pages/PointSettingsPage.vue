<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Save } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseErrorState from '@/components/ui/BaseErrorState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { getConfiguration, updateConfiguration } from '@/api/settings.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'

/**
 * The global point formula, expressed as "every `amountIqd` spent earns
 * `points` points" — for example 50,000 IQD = 10 points.
 *
 * This is the single rule that turns a subscription price into points, and it is
 * what subscription processing uses. A live preview is shown so an administrator
 * can see the effect of a change before saving — the arithmetic mirrors the
 * server's `floor(price / amountIqd) × points`, for display only. The backend
 * remains the source of truth for every award.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const configuration = useAsyncResource(() => getConfiguration(), {
  errorTitleKey: 'errors.loadSettingsFailed',
  toastOnError: false,
})

const amountIqd = ref('')
const points = ref('')
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

watch(
  () => configuration.data.value,
  (config) => {
    if (!config) return
    amountIqd.value = String(config.amountIqd)
    points.value = String(config.points)
  },
  { immediate: true },
)

const editable = computed(() => can(P.LoyaltyConfigurationUpdate))

/** An illustrative price, used only to show the formula's effect. */
const SAMPLE_PRICE = 100_000

const previewPoints = computed(() => {
  const divisor = Number(amountIqd.value)
  const multiplier = Number(points.value)
  if (!Number.isFinite(divisor) || !Number.isFinite(multiplier) || divisor <= 0) return null
  return Math.floor(SAMPLE_PRICE / divisor) * multiplier
})

/** "كل 50,000 IQD = 10 نقاط" — the rule stated the way it is configured. */
const ruleSummary = computed(() => {
  const amount = Number(amountIqd.value)
  const awarded = Number(points.value)
  if (!Number.isFinite(amount) || !Number.isFinite(awarded) || amount <= 0) return null
  return t('settings.ruleSummary', {
    amount: fmt.currency(amount),
    points: fmt.points(awarded),
  })
})

const dirty = computed(() => {
  const config = configuration.data.value
  if (!config) return false
  return Number(amountIqd.value) !== config.amountIqd || Number(points.value) !== config.points
})

async function save(): Promise<void> {
  if (saving.value) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    await updateConfiguration({
      amountIqd: Number(amountIqd.value),
      points: Number(points.value),
    })
    toast.success(t('settings.updated'))
    await configuration.refresh()
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
    <PageHeader :title="$t('settings.title')" :subtitle="$t('settings.subtitle')" />

    <div v-if="configuration.loading.value" class="grid gap-5 lg:grid-cols-3">
      <BaseSkeleton height="h-64" rounded="rounded-card" class="lg:col-span-2" />
      <BaseSkeleton height="h-40" rounded="rounded-card" />
    </div>

    <BaseCard v-else-if="configuration.error.value" flush>
      <BaseErrorState :error="configuration.error.value" @retry="configuration.refresh()" />
    </BaseCard>

    <div v-else class="grid gap-5 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <BaseCard>
          <form class="space-y-5" novalidate @submit.prevent="save">
            <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-model="amountIqd"
                type="number"
                inputmode="numeric"
                min="1"
                :label="$t('settings.amountIqd')"
                :hint="$t('settings.amountIqdHint')"
                :errors="fieldErrors.amountIqd"
                :disabled="!editable"
                dir="ltr"
                required
              />
              <BaseInput
                v-model="points"
                type="number"
                inputmode="numeric"
                min="1"
                :label="$t('settings.points')"
                :hint="$t('settings.pointsHint')"
                :errors="fieldErrors.points"
                :disabled="!editable"
                dir="ltr"
                required
              />
            </div>

            <!-- The configured rule restated in words, so the pair of numbers
                 reads as the sentence an operator is actually setting. -->
            <p v-if="ruleSummary" class="text-sm font-medium text-content">{{ ruleSummary }}</p>

            <div v-if="editable" class="flex justify-end border-t border-hairline pt-4">
              <BaseButton type="submit" variant="primary" :loading="saving" :disabled="!dirty">
                <template #icon><Save class="size-4" /></template>
                {{ $t('common.saveChanges') }}
              </BaseButton>
            </div>
          </form>
        </BaseCard>
      </div>

      <div class="space-y-4">
        <BaseCard :title="$t('settings.formula')">
          <div
            class="rounded-lg bg-surface-muted px-3 py-3 text-center font-mono text-sm text-content"
            dir="ltr"
          >
            floor(price ÷ {{ amountIqd || '?' }}) × {{ points || '?' }}
          </div>

          <div v-if="previewPoints !== null" class="mt-4">
            <p class="text-xs font-medium text-content-muted">{{ $t('settings.example') }}</p>
            <p class="mt-1 text-sm text-content">
              {{
                $t('settings.exampleValue', {
                  price: fmt.currency(SAMPLE_PRICE),
                  points: fmt.points(previewPoints),
                })
              }}
            </p>
          </div>

          <p class="mt-4 text-xs leading-relaxed text-content-subtle">
            {{ $t('settings.appliesNote') }}
          </p>
        </BaseCard>

        <BaseAlert variant="info">{{ $t('settings.defaultsNote') }}</BaseAlert>
      </div>
    </div>
  </div>
</template>
