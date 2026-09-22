<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseBadge from './BaseBadge.vue'
import type { PointTransactionType, VoucherStatus } from '@/types/models'

/**
 * The one place a backend status becomes a coloured label.
 *
 * Keeping the mapping here means a status renders identically everywhere, and
 * the values mapped are exactly the ones the API can return — there is no
 * invented state.
 */
const props = defineProps<{
  /** Generic active/inactive flag, used by most catalogue resources. */
  active?: boolean | null
  voucher?: VoucherStatus | null
  transaction?: PointTransactionType | null
  dot?: boolean
}>()

const { t } = useI18n()

const voucherVariants: Record<VoucherStatus, 'success' | 'info' | 'neutral' | 'danger'> = {
  Active: 'success',
  Used: 'info',
  Expired: 'neutral',
  Cancelled: 'danger',
}

const transactionVariants: Record<PointTransactionType, 'accent' | 'primary' | 'info'> = {
  Earned: 'accent',
  Spent: 'primary',
  Adjustment: 'info',
}

const resolved = computed(() => {
  if (props.voucher) {
    return {
      variant: voucherVariants[props.voucher],
      label: t(`vouchers.statuses.${props.voucher}`),
    }
  }
  if (props.transaction) {
    return {
      variant: transactionVariants[props.transaction],
      label: t(`transactions.types.${props.transaction}`),
    }
  }
  return props.active
    ? { variant: 'success' as const, label: t('common.active') }
    : { variant: 'neutral' as const, label: t('common.inactive') }
})
</script>

<template>
  <BaseBadge :variant="resolved.variant" :dot="dot ?? true">{{ resolved.label }}</BaseBadge>
</template>
