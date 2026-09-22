<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Printer, XCircle } from 'lucide-vue-next'
import QRCode from 'qrcode'
import BaseAlert from './BaseAlert.vue'
import BaseBadge from './BaseBadge.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import CopyButton from './CopyButton.vue'
import StatusBadge from './StatusBadge.vue'
import { cancelVoucher } from '@/api/adminVouchers.api'
import { useApiError } from '@/composables/useApiError'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { useUiStore } from '@/stores/ui.store'
import { P } from '@/utils/permissions'
import type { AdminVoucher } from '@/types/models'

/**
 * Voucher detail for an administrator, including the scannable code.
 *
 * The QR is rendered from the API's own `qrCodeData` — the dashboard never invents a
 * voucher payload — and every figure shown is the snapshot the voucher was issued
 * under, not the branch rule's current values.
 */
const props = defineProps<{ voucher: AdminVoucher | null }>()
const emit = defineEmits<{ close: []; cancelled: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const ui = useUiStore()
const toast = useToastStore()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor } = useApiError()

const qrDataUrl = ref<string | null>(null)
const qrFailed = ref(false)
const cancelling = ref(false)

watch(
  () => props.voucher,
  async (voucher) => {
    qrDataUrl.value = null
    qrFailed.value = false
    // No token means the offer issues vouchers without one — not a failure to render.
    const token = voucher?.qrCodeData
    if (!token) return

    try {
      // Dark-on-light regardless of theme: a scanner needs the contrast, and the
      // tile it sits on stays white in both themes.
      qrDataUrl.value = await QRCode.toDataURL(token, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: { dark: '#181426', light: '#ffffff' },
      })
    } catch {
      qrFailed.value = true
    }
  },
  { immediate: true },
)

const discountLabel = computed(() => {
  const voucher = props.voucher
  if (!voucher) return '—'
  return voucher.discountType === 'Percentage'
    ? fmt.percent(voucher.discountValue)
    : fmt.currency(voucher.discountValue)
})

async function cancel(): Promise<void> {
  if (!props.voucher || cancelling.value) return

  const confirmed = await confirm({
    title: t('vouchers.cancelConfirmTitle'),
    body: t('vouchers.cancelConfirmBody'),
    confirmLabel: t('vouchers.cancel'),
    destructive: true,
  })
  if (!confirmed) return

  cancelling.value = true
  try {
    await cancelVoucher(props.voucher.id)
    toast.success(t('vouchers.cancelled'), t('vouchers.cancelNoRefundNote'))
    emit('cancelled')
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  } finally {
    cancelling.value = false
  }
}

function print(): void {
  window.print()
}
</script>

<template>
  <BaseModal
    :open="voucher !== null"
    :title="$t('vouchers.detailTitle')"
    size="md"
    @close="emit('close')"
  >
    <div v-if="voucher" class="space-y-4">
      <div class="flex flex-col items-center gap-3 rounded-xl bg-white p-5 ring-1 ring-hairline">
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          :alt="$t('vouchers.qrCode')"
          class="size-40 object-contain"
        />
        <!-- Nothing to render and never will be: say so instead of shimmering. -->
        <div
          v-else-if="!voucher.qrCodeData"
          class="flex size-40 items-center justify-center px-3 text-center text-xs text-content-muted"
        >
          {{ $t('vouchers.noQrCode') }}
        </div>
        <div
          v-else-if="qrFailed"
          class="flex size-40 items-center justify-center text-center text-xs text-content-muted"
        >
          {{ $t('errors.generic') }}
        </div>
        <div v-else class="skeleton-shimmer size-40 rounded" aria-hidden="true" />

        <p class="text-center font-mono text-sm font-semibold tracking-wide text-primary-950" dir="ltr">
          {{ voucher.voucherCode }}
        </p>
      </div>

      <dl class="space-y-2.5 text-sm">
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.voucherCode') }}</dt>
          <dd class="flex min-w-0 items-center gap-1">
            <span class="truncate font-mono text-xs" dir="ltr">{{ voucher.voucherCode }}</span>
            <CopyButton :value="voucher.voucherCode" />
          </dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.offer') }}</dt>
          <dd class="min-w-0 truncate font-medium text-content">{{ voucher.offerTitle ?? '—' }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.merchant') }}</dt>
          <dd class="min-w-0 truncate text-content">{{ voucher.merchantName ?? '—' }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.branch') }}</dt>
          <dd class="min-w-0 truncate text-content">
            {{ voucher.branchName ?? $t('vouchers.noBranch') }}
          </dd>
        </div>
        <div v-if="voucher.cityName" class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.city') }}</dt>
          <dd class="min-w-0 truncate text-content">{{ voucher.cityName }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.discount') }}</dt>
          <dd class="flex items-center gap-1.5">
            <span class="font-semibold tabular-nums text-content">{{ discountLabel }}</span>
            <BaseBadge v-if="voucher.discountType === 'FixedAmount'" size="sm" variant="accent">
              {{ $t('discountTypes.FixedAmount') }}
            </BaseBadge>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.pointsSpent') }}</dt>
          <dd class="font-semibold tabular-nums text-content">
            {{ fmt.points(voucher.pointsSpent) }}
          </dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.user') }}</dt>
          <dd class="flex min-w-0 items-center gap-1">
            <span class="truncate font-mono text-xs text-content" dir="ltr">
              {{ fmt.shortId(voucher.externalUserId) }}
            </span>
            <CopyButton :value="voucher.externalUserId" />
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('common.status') }}</dt>
          <dd><StatusBadge :voucher="voucher.status" /></dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.activatedAt') }}</dt>
          <dd class="text-content">{{ fmt.dateTime(voucher.activatedAt) }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.expiresAt') }}</dt>
          <dd class="text-content">{{ fmt.dateTime(voucher.expiresAt) }}</dd>
        </div>
        <div v-if="voucher.usedAt" class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.usedAt') }}</dt>
          <dd class="text-content">{{ fmt.dateTime(voucher.usedAt) }}</dd>
        </div>
      </dl>

      <BaseAlert v-if="voucher.status === 'Active' && can(P.VouchersCancel)" variant="warning">
        {{ $t('vouchers.cancelNoRefundNote') }}
      </BaseAlert>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
      <BaseButton
        v-if="voucher?.status === 'Active' && can(P.VouchersCancel)"
        variant="danger"
        :loading="cancelling"
        @click="cancel"
      >
        <template #icon><XCircle class="size-4" /></template>
        {{ $t('vouchers.cancel') }}
      </BaseButton>
      <BaseButton variant="primary" @click="print">
        <template #icon><Printer class="size-4" /></template>
        {{ $t('common.print') }}
      </BaseButton>
    </template>
  </BaseModal>

  <!-- Print sheet: the modal is inside a transformed overlay browsers paginate badly. -->
  <div v-if="voucher" class="hidden print:block print:p-8" :dir="ui.isRtl ? 'rtl' : 'ltr'">
    <h1 class="mb-1 text-xl font-bold">{{ voucher.offerTitle }}</h1>
    <p v-if="voucher.merchantName" class="mb-1 text-sm">{{ voucher.merchantName }}</p>
    <p v-if="voucher.branchName" class="mb-4 text-sm">{{ voucher.branchName }}</p>
    <img v-if="qrDataUrl" :src="qrDataUrl" alt="" class="mb-3 size-48" />
    <p class="font-mono text-lg font-bold" dir="ltr">{{ voucher.voucherCode }}</p>
    <p class="mt-2 text-sm">{{ $t('vouchers.discount') }}: {{ discountLabel }}</p>
    <p class="text-sm">{{ $t('vouchers.expiresAt') }}: {{ fmt.dateTime(voucher.expiresAt) }}</p>
  </div>
</template>
