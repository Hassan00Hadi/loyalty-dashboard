<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Users } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import { createBranchRule, updateBranchRule } from '@/api/branchRules.api'
import { useApiError } from '@/composables/useApiError'
import { useFormat } from '@/composables/useFormat'
import { useToastStore } from '@/stores/toast.store'
import {
  DISCOUNT_TYPES,
  type AdminOffer,
  type BranchOfferRule,
  type DiscountType,
  type MerchantBranch,
} from '@/types/models'

/**
 * Create or edit one branch offer rule.
 *
 * Shared by the branch rules page and the offer's branch pricing view, so both
 * write rules through the same validation, error mapping and payload. Nothing is
 * calculated here: the form collects the terms and the backend validates them.
 *
 * The offer's own values are shown beside each input, so the administrator can see
 * what the rule is overriding.
 */
const props = defineProps<{
  open: boolean
  /** The rule being edited, or null to create one. */
  rule: BranchOfferRule | null
  /** Offers to choose from; the chosen one supplies the defaults shown as hints. */
  offers: AdminOffer[]
  branches: Pick<MerchantBranch, 'id' | 'name' | 'merchantId'>[]
  /** Pre-fills a new rule, e.g. from a row of the branch pricing table. */
  presetOfferId?: string | null
  presetBranchId?: string | null
  /** Fixes the preset offer and branch, when the caller has already chosen them. */
  lockTarget?: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: [rule: BranchOfferRule]
}>()

const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { messageFor, fieldErrorsOf } = useApiError()

const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({
  offerId: null as string | null,
  branchId: null as string | null,
  requiredPoints: '',
  discountType: 'Percentage' as DiscountType,
  discountValue: '',
  voucherValidityDays: '30',
  startsAtUtc: '',
  endsAtUtc: '',
  isActive: true,
})

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`; the API returns a full ISO instant. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    formError.value = null
    fieldErrors.value = {}

    const rule = props.rule
    form.value = rule
      ? {
          offerId: rule.offerId,
          branchId: rule.branchId,
          requiredPoints: String(rule.requiredPoints),
          discountType: rule.discountType,
          discountValue: String(rule.discountValue),
          voucherValidityDays: String(rule.voucherValidityDays),
          startsAtUtc: toLocalInput(rule.startsAtUtc),
          endsAtUtc: toLocalInput(rule.endsAtUtc),
          isActive: rule.isActive,
        }
      : {
          offerId: props.presetOfferId ?? null,
          branchId: props.presetBranchId ?? null,
          requiredPoints: '',
          discountType: 'Percentage',
          discountValue: '',
          voucherValidityDays: '30',
          startsAtUtc: '',
          endsAtUtc: '',
          isActive: true,
        }
  },
)

const offerOptions = computed<SelectOption[]>(() =>
  props.offers.map((offer) => ({ value: offer.id, label: offer.title })),
)

const selectedOffer = computed(
  () => props.offers.find((offer) => offer.id === form.value.offerId) ?? null,
)

/**
 * The branches offered by the form, narrowed to the chosen offer's merchant.
 *
 * The backend refuses a branch from another merchant; filtering here means the
 * administrator does not have to discover that by being rejected.
 */
const branchOptions = computed<SelectOption[]>(() => {
  const merchantId = selectedOffer.value?.merchantId
  if (!merchantId) return []

  return props.branches
    .filter((branch) => branch.merchantId === merchantId)
    .map((branch) => ({ value: branch.id, label: branch.name }))
})

watch(
  () => form.value.offerId,
  () => {
    // Only on a user's change: opening the form sets both fields together.
    if (props.lockTarget || props.rule) return
    const stillValid = branchOptions.value.some((option) => option.value === form.value.branchId)
    if (!stillValid) form.value.branchId = null
  },
)

const discountTypeOptions = computed<SelectOption[]>(() =>
  DISCOUNT_TYPES.map((type) => ({ value: type, label: t(`discountTypes.${type}`) })),
)

// ── Offer defaults as hints ───────────────────────────────────────────────────

function withDefault(hint: string, value: string | null): string {
  return value === null ? hint : `${t('branchRules.offerDefault', { value })} · ${hint}`
}

const defaults = computed(() => {
  const offer = selectedOffer.value
  if (!offer) return null
  return {
    points: t('branchRules.pointsValue', { points: fmt.points(offer.requiredPoints) }),
    discountType: t(`discountTypes.${offer.discountType}`),
    discount: fmt.discount(offer.discountType, offer.discountValue),
    validity: t('branchRules.voucherValidityDays', { days: fmt.number(offer.validDays) }),
  }
})

const pointsHint = computed(() =>
  withDefault(t('branchRules.requiredPointsHint'), defaults.value?.points ?? null),
)

const discountHint = computed(() =>
  withDefault(
    form.value.discountType === 'Percentage'
      ? t('branchRules.discountValueHintPercentage')
      : t('branchRules.discountValueHintFixed'),
    defaults.value?.discount ?? null,
  ),
)

const validityHint = computed(() =>
  withDefault(t('branchRules.voucherValidityHint'), defaults.value?.validity ?? null),
)

// ── Save ──────────────────────────────────────────────────────────────────────

async function save(): Promise<void> {
  if (saving.value) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    const startsAtUtc = form.value.startsAtUtc
      ? new Date(form.value.startsAtUtc).toISOString()
      : null
    const endsAtUtc = form.value.endsAtUtc ? new Date(form.value.endsAtUtc).toISOString() : null

    let saved: BranchOfferRule
    if (props.rule) {
      saved = await updateBranchRule(props.rule.id, {
        requiredPoints: Number(form.value.requiredPoints),
        discountType: form.value.discountType,
        discountValue: Number(form.value.discountValue),
        voucherValidityDays: Number(form.value.voucherValidityDays),
        startsAtUtc,
        endsAtUtc,
        // Distinguishes "no window" from "leave the window alone", which both send null.
        clearWindow: startsAtUtc === null && endsAtUtc === null,
        isActive: form.value.isActive,
      })
      toast.success(t('branchRules.updated'))
    } else {
      saved = await createBranchRule({
        offerId: form.value.offerId ?? '',
        branchId: form.value.branchId ?? '',
        requiredPoints: Number(form.value.requiredPoints),
        discountType: form.value.discountType,
        discountValue: Number(form.value.discountValue),
        voucherValidityDays: Number(form.value.voucherValidityDays),
        startsAtUtc,
        endsAtUtc,
        isActive: form.value.isActive,
      })
      toast.success(t('branchRules.created'))
    }

    emit('saved', saved)
    emit('close')
  } catch (error) {
    // 409 (a rule already exists for this offer and branch) and the branch/merchant
    // mismatch arrive as codes that `messageFor` already localises.
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    size="lg"
    :title="rule ? $t('branchRules.editTitle') : $t('branchRules.createTitle')"
    @close="emit('close')"
  >
    <form class="space-y-4" novalidate @submit.prevent="save">
      <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

      <!--
        Read-only statistic for the rule being edited, kept outside the form's
        own state so it is never sent back on save. A new rule has no
        completions yet, so it only appears when editing.
      -->
      <section v-if="rule" class="flex items-center gap-3 rounded-lg bg-surface-muted p-4">
        <Users class="size-5 shrink-0 text-content-subtle" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-xs text-content-muted">{{ $t('branchRules.completedUsers') }}</p>
          <p class="text-lg font-semibold tabular-nums text-content">
            {{ fmt.number(rule.completedByUserCount ?? 0) }}
          </p>
        </div>
      </section>

      <div class="grid gap-4 sm:grid-cols-2">
        <BaseSelect
          v-model="form.offerId"
          :options="offerOptions"
          :label="$t('branchRules.offer')"
          :placeholder="$t('branchRules.allOffers')"
          :errors="fieldErrors.offerId"
          :disabled="rule !== null || lockTarget"
          required
        />
        <BaseSelect
          v-model="form.branchId"
          :options="branchOptions"
          :label="$t('branchRules.branch')"
          :placeholder="$t('branchRules.allBranches')"
          :errors="fieldErrors.branchId"
          :disabled="rule !== null || lockTarget || !form.offerId"
          required
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <BaseInput
          v-model="form.requiredPoints"
          type="number"
          inputmode="numeric"
          min="1"
          :label="$t('branchRules.requiredPoints')"
          :hint="pointsHint"
          :errors="fieldErrors.requiredPoints"
          dir="ltr"
          required
        />
        <BaseSelect
          v-model="form.discountType"
          :options="discountTypeOptions"
          :label="$t('branchRules.discountType')"
          :hint="defaults ? $t('branchRules.offerDefault', { value: defaults.discountType }) : undefined"
          :errors="fieldErrors.discountType"
          required
        />
        <BaseInput
          v-model="form.discountValue"
          type="number"
          inputmode="decimal"
          min="0"
          :max="form.discountType === 'Percentage' ? 100 : undefined"
          step="any"
          :label="$t('branchRules.discountValue')"
          :hint="discountHint"
          :errors="fieldErrors.discountValue"
          dir="ltr"
          required
        />
      </div>

      <BaseInput
        v-model="form.voucherValidityDays"
        type="number"
        inputmode="numeric"
        min="1"
        max="730"
        :label="$t('branchRules.voucherValidity')"
        :hint="validityHint"
        :errors="fieldErrors.voucherValidityDays"
        dir="ltr"
        required
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="form.startsAtUtc"
          type="datetime-local"
          :label="$t('branchRules.startDate')"
          :errors="fieldErrors.startsAtUtc"
          dir="ltr"
        />
        <BaseInput
          v-model="form.endsAtUtc"
          type="datetime-local"
          :label="$t('branchRules.endDate')"
          :hint="$t('branchRules.windowHint')"
          :errors="fieldErrors.endsAtUtc"
          dir="ltr"
        />
      </div>

      <BaseToggle v-model="form.isActive" :label="$t('common.active')" />
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="saving" @click="emit('close')">
        {{ $t('common.cancel') }}
      </BaseButton>
      <BaseButton variant="primary" :loading="saving" @click="save">
        {{ rule ? $t('common.saveChanges') : $t('common.create') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
