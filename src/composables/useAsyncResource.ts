import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NormalisedError } from '@/types/api'
import { useApiError } from './useApiError'

/**
 * One async read, with the four states every page needs to render.
 *
 * `loading`, `error`, `data` and "empty" are derived here rather than being
 * re-declared as three `ref`s in every page. A refetch keeps the previous data
 * visible until the new data lands, so a filter change does not blank the table.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  options: {
    /** i18n key for the toast title, e.g. `errors.loadOffersFailed`. */
    errorTitleKey?: string
    immediate?: boolean
    /** Set false to keep failures inline only, with no toast. */
    toastOnError?: boolean
  } = {},
) {
  const { report, toNormalised } = useApiError()
  const { t } = useI18n()

  const data = shallowRef<T | null>(null)
  const error = ref<NormalisedError | null>(null)
  /** True only for the first load, when there is nothing to show yet. */
  const loading = ref(false)
  /** True for a reload that happens while data is already on screen. */
  const refreshing = ref(false)

  const loaded = computed(() => data.value !== null)

  let sequence = 0

  async function execute(options2: { silent?: boolean } = {}): Promise<T | null> {
    const attempt = ++sequence
    const hasData = data.value !== null

    if (hasData && options2.silent !== false) {
      refreshing.value = true
    } else {
      loading.value = true
    }
    error.value = null

    try {
      const result = await fetcher()
      // A slower earlier request must not overwrite a newer result.
      if (attempt !== sequence) return null
      data.value = result
      return result
    } catch (caught) {
      if (attempt !== sequence) return null

      // The error is always kept so the page can show an inline error state with
      // a retry; the toast is suppressible for pages that do that instead.
      if (options.toastOnError === false) {
        error.value = toNormalised(caught)
      } else {
        error.value = report(
          caught,
          options.errorTitleKey ? t(options.errorTitleKey) : t('errors.loadFailed'),
        )
      }
      return null
    } finally {
      if (attempt === sequence) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  if (options.immediate !== false) {
    void execute()
  }

  return { data, error, loading, refreshing, loaded, execute, refresh: () => execute() }
}
