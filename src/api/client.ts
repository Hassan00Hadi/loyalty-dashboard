/**
 * The single Axios instance every API module goes through.
 *
 * Two things are centralised here so that no screen has to think about them:
 * the bearer token is attached on the way out, and every failure is turned into
 * a `NormalisedError` on the way back. Callers therefore see either unwrapped
 * `data` or a thrown object with a stable shape — never an `AxiosError`, a raw
 * status code, or an envelope.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ApiResponse, NormalisedError } from '@/types/api'

/** Synthetic codes for failures that never reached the application layer. */
export const TRANSPORT_ERROR = 'NETWORK_ERROR'
export const TIMEOUT_ERROR = 'TIMEOUT'
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
export const UNAUTHORIZED = 'UNAUTHORIZED'
export const FORBIDDEN = 'FORBIDDEN'

// Trimmed because a stray space in a `.env` line — `VITE_API_BASE_URL= http://…`
// — is kept verbatim by Vite, and would otherwise be sent as part of the URL.
const baseURL = (import.meta.env.VITE_API_BASE_URL ?? '/').trim().replace(/\/+$/, '')

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token plumbing ────────────────────────────────────────────────────────────
// The token is held by a callback rather than read from storage directly, so the
// auth store stays the only owner of session state and this module has no
// opinion about where it is persisted.

let tokenProvider: () => string | null = () => null
let onUnauthenticated: (() => void) | null = null
let onForbidden: ((error: NormalisedError) => void) | null = null

export function configureAuth(options: {
  getToken: () => string | null
  onUnauthenticated?: () => void
  onForbidden?: (error: NormalisedError) => void
}): void {
  tokenProvider = options.getToken
  onUnauthenticated = options.onUnauthenticated ?? null
  onForbidden = options.onForbidden ?? null
}

/**
 * Runs the session handlers for a failure that bypassed the response
 * interceptor — a request that reads its body as a blob and therefore inspects
 * the status itself. Keeps "a 401 ends the session" true for every call, not
 * just the enveloped ones.
 */
export function notifyAuthFailure(error: NormalisedError): void {
  if (error.status === 401) {
    onUnauthenticated?.()
  } else if (error.status === 403) {
    onForbidden?.(error)
  }
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenProvider()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Error normalisation ───────────────────────────────────────────────────────

function extractFieldErrors(details: unknown): Record<string, string[]> {
  if (!details || typeof details !== 'object') return {}

  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    // The server sends `{ "Price": ["price is required."] }`. Field keys are
    // lower-cased so a template can look them up by the property name it binds.
    const field = key.charAt(0).toLowerCase() + key.slice(1)
    if (Array.isArray(value)) {
      result[field] = value.map(String)
    } else if (typeof value === 'string') {
      result[field] = [value]
    }
  }
  return result
}

/**
 * Collapses anything Axios can reject with into one displayable shape.
 *
 * A validation failure keeps its per-field messages; everything else keeps the
 * backend's own message, which is already written for an end user. Nothing from
 * an exception or stack trace is surfaced.
 */
export function normaliseError(error: unknown): NormalisedError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>
    const status = axiosError.response?.status ?? null
    const envelope = axiosError.response?.data
    const traceId = envelope?.meta?.traceId ?? null

    if (envelope?.error) {
      return {
        code: envelope.error.code || UNKNOWN_ERROR,
        message: envelope.error.message || axiosError.message,
        status,
        traceId,
        fieldErrors: extractFieldErrors(envelope.error.details),
      }
    }

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return {
        code: TIMEOUT_ERROR,
        message: 'The request timed out.',
        status,
        traceId,
        fieldErrors: {},
      }
    }

    if (!axiosError.response) {
      return {
        code: TRANSPORT_ERROR,
        message: 'Could not reach the server.',
        status: null,
        traceId: null,
        fieldErrors: {},
      }
    }

    return {
      code: status === 401 ? UNAUTHORIZED : status === 403 ? FORBIDDEN : UNKNOWN_ERROR,
      message: envelope?.message || axiosError.message,
      status,
      traceId,
      fieldErrors: {},
    }
  }

  return {
    code: UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    status: null,
    traceId: null,
    fieldErrors: {},
  }
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalised = normaliseError(error)

    // 401 ends the session. The handler is invoked rather than redirecting here
    // so the store can clear its own state and the router can decide where to go.
    if (normalised.status === 401) {
      onUnauthenticated?.()
    } else if (normalised.status === 403) {
      onForbidden?.(normalised)
    }

    return Promise.reject(normalised)
  },
)

// ── Verb helpers ──────────────────────────────────────────────────────────────
// Each unwraps the envelope so callers work with `T`, not `ApiResponse<T>`.

/**
 * A success envelope whose `data` is null is treated as a failure rather than
 * returned as `null`: the endpoints used here always carry a payload on success,
 * so a missing one means the response was not what the caller's type claims.
 */
function unwrap<T>(envelope: ApiResponse<T>): T {
  if (!envelope.success || envelope.data === null || envelope.data === undefined) {
    throw {
      code: envelope.error?.code ?? UNKNOWN_ERROR,
      message: envelope.error?.message ?? envelope.message ?? 'The request failed.',
      status: null,
      traceId: envelope.meta?.traceId ?? null,
      fieldErrors: extractFieldErrors(envelope.error?.details),
    } satisfies NormalisedError
  }
  return envelope.data
}

/** Drops null and undefined so optional filters never become `?type=null`. */
function clean(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined
  const entries = Object.entries(params).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await http.get<ApiResponse<T>>(url, { ...config, params: clean(params) })
  return unwrap(response.data)
}

/**
 * Lets the browser own the Content-Type for a multipart body.
 *
 * The instance declares `application/json` for the common case, but a multipart
 * body must carry the boundary the browser generates — sending the declared JSON
 * type, or even a bare `multipart/form-data`, leaves the server unable to parse
 * the parts. Setting it to undefined is what makes Axios defer to the browser.
 *
 * Done here rather than at each call site so no caller has to remember it.
 */
function withFormData(body: unknown, config?: AxiosRequestConfig): AxiosRequestConfig | undefined {
  if (!(body instanceof FormData)) return config

  return {
    ...config,
    headers: { ...config?.headers, 'Content-Type': undefined },
  }
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.post<ApiResponse<T>>(url, body, withFormData(body, config))
  return unwrap(response.data)
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.put<ApiResponse<T>>(url, body, withFormData(body, config))
  return unwrap(response.data)
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.patch<ApiResponse<T>>(url, body, withFormData(body, config))
  return unwrap(response.data)
}

/**
 * DELETE endpoints answer 200 with an enveloped `bool` rather than 204, so the
 * body is read for its error code on failure and the flag is discarded on success.
 */
export async function apiDelete(url: string): Promise<void> {
  const response = await http.delete<ApiResponse<boolean>>(url)
  if (!response.data.success) {
    throw {
      code: response.data.error?.code ?? UNKNOWN_ERROR,
      message: response.data.error?.message ?? response.data.message ?? 'The request failed.',
      status: null,
      traceId: response.data.meta?.traceId ?? null,
      fieldErrors: extractFieldErrors(response.data.error?.details),
    } satisfies NormalisedError
  }
}
