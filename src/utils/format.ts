/**
 * Locale-aware formatting, defined once.
 *
 * Every date, number and money value in the app goes through here so that
 * switching language reformats consistently and no component grows its own
 * `toLocaleString` call with slightly different options.
 *
 * Arabic uses the `ar-IQ` locale with Latin digits (`nu-latn`): Iraqi business
 * software conventionally shows Western Arabic numerals, and mixing digit
 * systems between the two languages makes figures hard to compare.
 */

export type AppLocale = 'en' | 'ar'

function intlLocale(locale: AppLocale): string {
  return locale === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US'
}

/** Parses an API timestamp, tolerating a missing UTC marker. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  // The backend serialises DateTime without a zone designator in places. Those
  // instants are UTC, so an explicit `Z` is added rather than letting the browser
  // read them as local time and shift the displayed hour.
  const normalised = /[Z+]|-\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
  const parsed = new Date(normalised)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: AppLocale,
): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: AppLocale,
): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(
  value: string | Date | null | undefined,
  locale: AppLocale,
): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Time to the millisecond, 24-hour, for log lines where order within a second matters. */
export function formatPreciseTime(
  value: string | Date | null | undefined,
  locale: AppLocale,
): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).format(date)
}

export function formatNumber(
  value: number | null | undefined,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(intlLocale(locale), options).format(value)
}

/** Point balances are always whole numbers and always grouped. */
export function formatPoints(value: number | null | undefined, locale: AppLocale): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0 })
}

/**
 * Money, in Iraqi dinar.
 *
 * IQD is conventionally shown without decimal places, which also matches the
 * backend's default point threshold being expressed in whole dinar.
 */
export function formatCurrency(
  value: number | null | undefined,
  locale: AppLocale,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(
  value: number | null | undefined,
  locale: AppLocale,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  // The API sends 25 for 25%, not 0.25, so the value is divided before formatting.
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value / 100)
}

/** Human-readable byte size, for attachment listings. */
export function formatBytes(value: number | null | undefined, locale: AppLocale): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${formatNumber(size, locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

/**
 * Shortens a GUID for display in a table cell.
 *
 * The full value stays available via `title` and copy actions; this is only to
 * stop a 36-character id dominating a row.
 */
export function shortId(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 13 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`
}
