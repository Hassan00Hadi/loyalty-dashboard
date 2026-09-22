import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PAGE_SIZE, type NormalisedError, type PagedResult } from '@/types/api'
import { useApiError } from './useApiError'

/**
 * A server-side paged list.
 *
 * Owns the page cursor and page size, and re-fetches whenever either changes or
 * a caller's filter ref changes. Only the requested page is ever fetched, which
 * is what keeps a large table from pulling thousands of rows.
 */
export function usePagedResource<T>(
  fetcher: (query: { page: number; pageSize: number }) => Promise<PagedResult<T>>,
  options: {
    errorTitleKey?: string
    pageSize?: number
    /** Changing any of these resets to page 1 and refetches. */
    watchSources?: Parameters<typeof watch>[0]
    immediate?: boolean
    /**
     * Set false to keep failures inline only, with no toast — for a page that
     * renders an expected failure, such as a 403, as an explanation of its own.
     */
    toastOnError?: boolean
  } = {},
) {
  const { report, toNormalised } = useApiError()
  const { t } = useI18n()

  const items = shallowRef<T[]>([])
  const page = ref(1)
  const pageSize = ref(options.pageSize ?? DEFAULT_PAGE_SIZE)
  const totalCount = ref(0)
  const totalPages = ref(0)
  const hasNextPage = ref(false)
  const hasPreviousPage = ref(false)

  const error = ref<NormalisedError | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  /** False until the first response, so "empty" is not shown before loading. */
  const loaded = ref(false)

  const isEmpty = computed(() => loaded.value && items.value.length === 0)

  /** 1-based index of the first row on this page, for "showing X–Y of Z". */
  const rangeFrom = computed(() =>
    totalCount.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
  )
  const rangeTo = computed(() => Math.min(page.value * pageSize.value, totalCount.value))

  let sequence = 0

  async function execute(): Promise<void> {
    const attempt = ++sequence
    if (loaded.value) refreshing.value = true
    else loading.value = true
    error.value = null

    try {
      const result = await fetcher({ page: page.value, pageSize: pageSize.value })
      if (attempt !== sequence) return

      items.value = result.items
      totalCount.value = result.totalCount
      totalPages.value = result.totalPages
      hasNextPage.value = result.hasNextPage
      hasPreviousPage.value = result.hasPreviousPage
      loaded.value = true

      // Deleting the last row of the last page leaves the cursor past the end;
      // stepping back re-fetches rather than showing a blank table.
      if (result.items.length === 0 && page.value > 1 && result.totalPages > 0) {
        page.value = Math.min(page.value - 1, result.totalPages)
      }
    } catch (caught) {
      if (attempt !== sequence) return

      // The error is always kept so the page can render it inline; the toast is
      // suppressible for a page that explains the failure itself.
      error.value =
        options.toastOnError === false
          ? toNormalised(caught)
          : report(
              caught,
              options.errorTitleKey ? t(options.errorTitleKey) : t('errors.loadFailed'),
            )
      loaded.value = true
    } finally {
      if (attempt === sequence) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  function goToPage(next: number): void {
    const target = Math.max(1, totalPages.value ? Math.min(next, totalPages.value) : next)
    if (target === page.value) return
    page.value = target
  }

  function setPageSize(next: number): void {
    if (next === pageSize.value) return
    pageSize.value = next
    page.value = 1
  }

  /** Returns to page 1. Used when a filter changes. */
  function reset(): void {
    if (page.value === 1) {
      void execute()
      return
    }
    page.value = 1
  }

  watch([page, pageSize], () => void execute())

  if (options.watchSources) {
    watch(options.watchSources, () => reset(), { deep: true })
  }

  if (options.immediate !== false) {
    void execute()
  }

  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    error,
    loading,
    refreshing,
    loaded,
    isEmpty,
    rangeFrom,
    rangeTo,
    execute,
    refresh: execute,
    goToPage,
    setPageSize,
    reset,
  }
}
