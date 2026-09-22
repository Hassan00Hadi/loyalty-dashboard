/**
 * Transport-level shapes shared by every endpoint.
 *
 * These mirror `ApiResponse<T>` and `PagedResult<T>` on the server. They are kept
 * separate from the domain models so that a change to the envelope touches one file.
 */

export interface ApiError {
  code: string
  message: string
  /** Field-keyed validation messages, present on VALIDATION_ERROR responses. */
  details?: Record<string, string[]> | Record<string, unknown> | null
}

export interface ApiMeta {
  traceId?: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T | null
  error: ApiError | null
  meta: ApiMeta | null
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PageRequest {
  page?: number
  pageSize?: number
}

/** Server-side page size ceiling (`PageRequest.MaxPageSize`). */
export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 20

/**
 * A failed call, normalised by the Axios layer so callers never touch
 * `AxiosError` or a raw status code.
 */
export interface NormalisedError {
  /** Backend error code, or a synthetic one for transport failures. */
  code: string
  /** Human-readable message, safe to display. */
  message: string
  status: number | null
  traceId: string | null
  /** Field-keyed validation messages, for binding onto form controls. */
  fieldErrors: Record<string, string[]>
}
