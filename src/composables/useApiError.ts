import { useI18n } from 'vue-i18n'
import { useToastStore } from '@/stores/toast.store'
import type { NormalisedError } from '@/types/api'

function isNormalised(value: unknown): value is NormalisedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'fieldErrors' in value
  )
}

/**
 * Turns a thrown API failure into text a user should see.
 *
 * The rule is: prefer a localised message for a code we know, fall back to the
 * backend's own message — which is already written for an end user — and only
 * then to a generic string. Nothing from an exception or stack trace is ever
 * surfaced, because the Axios layer has already discarded it.
 */
export function useApiError() {
  const { t, te, locale } = useI18n()
  const toast = useToastStore()

  function toNormalised(error: unknown): NormalisedError {
    if (isNormalised(error)) return error
    return {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error ?? ''),
      status: null,
      traceId: null,
      fieldErrors: {},
    }
  }

  /** The best available message for a failure. */
  function messageFor(error: unknown): string {
    const normalised = toNormalised(error)

    const codeKey = `errors.codes.${normalised.code}`
    if (te(codeKey)) return t(codeKey)

    switch (normalised.status) {
      case 401:
        return t('errors.unauthorized')
      case 403:
        return t('errors.forbidden')
      case 404:
        return t('errors.notFound')
      case 409:
        return t('errors.conflict')
      default:
        break
    }

    if (normalised.code === 'NETWORK_ERROR') return t('errors.network')
    if (normalised.code === 'TIMEOUT') return t('errors.timeout')
    if (normalised.status !== null && normalised.status >= 500) return t('errors.server')

    // The backend writes its messages in English. Falling back to one is right
    // in English, but in Arabic it would put a stray English sentence in front
    // of an operator, so a validation failure there shows the generic Arabic
    // message instead — the per-field messages still bind to the form controls.
    if (locale.value !== 'en' && !isLocalisable(normalised.message)) {
      return normalised.code === 'VALIDATION_ERROR'
        ? t('errors.validationFailed')
        : t('errors.generic')
    }

    return normalised.message || t('errors.generic')
  }

  /**
   * Whether a message is safe to show as-is in a non-English locale.
   *
   * Anything containing Arabic script was written for this audience — the
   * backend localises some copy — so it is shown; a purely Latin sentence is not.
   */
  function isLocalisable(message: string): boolean {
    return /[؀-ۿ]/.test(message)
  }

  /**
   * Reports a failure as a toast.
   *
   * `title` is the caller's context ("Failed to load offers"), and the derived
   * message becomes the description, so the notification says both what was
   * being attempted and why it failed.
   */
  function report(error: unknown, title?: string): NormalisedError {
    const normalised = toNormalised(error)

    // A 401 is already handled globally by signing the user out and showing its
    // own notice; a second toast here would be noise.
    if (normalised.status === 401) return normalised

    const description = messageFor(error)
    toast.error(title ?? t('errors.generic'), description, normalised.traceId)
    return normalised
  }

  /** Per-field messages for binding onto form controls. */
  function fieldErrorsOf(error: unknown): Record<string, string[]> {
    return toNormalised(error).fieldErrors
  }

  return { messageFor, report, fieldErrorsOf, toNormalised }
}
