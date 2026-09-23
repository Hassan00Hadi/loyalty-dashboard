<script setup lang="ts">
import { ref, watch } from 'vue'
import { Printer } from 'lucide-vue-next'
import QRCode from 'qrcode'
import BaseBadge from './BaseBadge.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import CopyButton from './CopyButton.vue'
import { useFormat } from '@/composables/useFormat'
import { useUiStore } from '@/stores/ui.store'
import type { Voucher } from '@/types/models'

/**
 * Voucher detail, including the scannable code.
 *
 * The QR is rendered from the API's own `qrCodeData` — the dashboard never
 * generates or guesses a voucher payload. Rendering is local (no image service),
 * which keeps the code readable offline and sends nothing to a third party.
 */
const props = defineProps<{ voucher: Voucher | null }>()
const emit = defineEmits<{ close: [] }>()

const fmt = useFormat()
const ui = useUiStore()

const qrDataUrl = ref<string | null>(null)
const qrFailed = ref(false)

watch(
  () => props.voucher,
  async (voucher) => {
    qrDataUrl.value = null
    qrFailed.value = false
    // No token means the offer issues vouchers without one. That is not a failure:
    // the code below stands on its own and the QR tile is simply absent.
    const token = voucher?.qrCodeData
    if (!token) return

    try {
      // Always rendered dark-on-light: a scanner needs the contrast regardless
      // of the dashboard's theme, and the tile below stays white in both.
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

function print(): void {
  window.print()
}
</script>

<template>
  <BaseModal
    :open="voucher !== null"
    :title="$t('vouchers.detailTitle')"
    size="sm"
    @close="emit('close')"
  >
    <div v-if="voucher" class="space-y-4">
      <!-- QR tile -->
      <div class="flex flex-col items-center gap-3 rounded-xl bg-white p-5 ring-1 ring-hairline">
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          :alt="$t('vouchers.qrCode')"
          class="size-44 object-contain"
        />
        <!--
          A voucher whose offer issues no QR has nothing to render and never will, so it
          says so rather than shimmering forever on a skeleton that cannot resolve.
        -->
        <div
          v-else-if="!voucher.qrCodeData"
          class="flex size-44 items-center justify-center px-3 text-center text-xs text-content-muted"
        >
          {{ $t('vouchers.noQrCode') }}
        </div>
        <div
          v-else-if="qrFailed"
          class="flex size-44 items-center justify-center text-center text-xs text-content-muted"
        >
          {{ $t('errors.generic') }}
        </div>
        <div v-else class="skeleton-shimmer size-44 rounded" aria-hidden="true" />

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
          <dd class="min-w-0 truncate font-medium text-content">{{ voucher.offerTitle }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.merchant') }}</dt>
          <dd class="min-w-0 truncate text-content">{{ voucher.merchantName ?? '—' }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.discount') }}</dt>
          <dd class="font-semibold tabular-nums text-content">
            {{ fmt.discount(voucher.discountType, voucher.discountValue) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('common.status') }}</dt>
          <dd>
            <BaseBadge
              :variant="
                voucher.status === 'Active'
                  ? 'success'
                  : voucher.status === 'Used'
                    ? 'info'
                    : voucher.status === 'Cancelled'
                      ? 'danger'
                      : 'neutral'
              "
              dot
            >
              {{ $t(`vouchers.statuses.${voucher.status}`) }}
            </BaseBadge>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-content-muted">{{ $t('vouchers.issuedAt') }}</dt>
          <dd class="text-content">{{ fmt.dateTime(voucher.createdAt) }}</dd>
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
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ $t('common.close') }}</BaseButton>
      <BaseButton variant="primary" @click="print">
        <template #icon><Printer class="size-4" /></template>
        {{ $t('common.print') }}
      </BaseButton>
    </template>
  </BaseModal>

  <!--
    Print sheet. The modal itself is inside a scrolling, transformed overlay
    which browsers paginate badly, so printing renders this plain block instead
    and the screen UI is hidden by the `no-print` rules in the stylesheet.
  -->
  <div v-if="voucher" class="hidden print:block print:p-8" :dir="ui.isRtl ? 'rtl' : 'ltr'">
    <h1 class="mb-1 text-xl font-bold">{{ voucher.offerTitle }}</h1>
    <p v-if="voucher.merchantName" class="mb-4 text-sm">{{ voucher.merchantName }}</p>
    <img v-if="qrDataUrl" :src="qrDataUrl" alt="" class="mb-3 size-48" />
    <p class="font-mono text-lg font-bold" dir="ltr">{{ voucher.voucherCode }}</p>
    <p class="mt-2 text-sm">
      {{ $t('vouchers.discount') }}: {{ fmt.discount(voucher.discountType, voucher.discountValue) }}
    </p>
    <p class="text-sm">{{ $t('vouchers.expiresAt') }}: {{ fmt.dateTime(voucher.expiresAt) }}</p>
  </div>
</template>
