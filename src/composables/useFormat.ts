import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  formatBytes,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPoints,
  formatTime,
  shortId,
  type AppLocale,
} from '@/utils/format'
import type { DiscountType } from '@/types/models'

/**
 * Binds the formatting helpers to the active locale.
 *
 * Components call `fmt.date(value)` rather than passing the locale at every
 * call site, and the results are reactive: switching language re-renders every
 * formatted value without any component doing work.
 */
export function useFormat() {
  const { locale } = useI18n()
  const current = computed<AppLocale>(() => (locale.value === 'ar' ? 'ar' : 'en'))

  return {
    locale: current,
    date: (value: string | Date | null | undefined) => formatDate(value, current.value),
    dateTime: (value: string | Date | null | undefined) => formatDateTime(value, current.value),
    time: (value: string | Date | null | undefined) => formatTime(value, current.value),
    number: (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, current.value, options),
    points: (value: number | null | undefined) => formatPoints(value, current.value),
    currency: (value: number | null | undefined) => formatCurrency(value, current.value),
    percent: (value: number | null | undefined) => formatPercent(value, current.value),
    /** A percentage for percentage discounts, otherwise an IQD amount. */
    discount: (type: DiscountType, value: number | null | undefined) =>
      type === 'Percentage'
        ? formatPercent(value, current.value)
        : formatCurrency(value, current.value),
    bytes: (value: number | null | undefined) => formatBytes(value, current.value),
    shortId,
  }
}
