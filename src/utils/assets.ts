/**
 * Turns a URL the API returned into one the browser can load.
 *
 * Attachment images — merchant logos, category icons — are served publicly, so
 * an `<img>` loads them directly with no token of any kind. What the browser
 * cannot do is resolve a *relative* URL correctly: `/api/v1/...` in an `<img>`
 * resolves against the page's own origin, which is the dashboard (for example
 * `http://localhost:5174`), not the API. This prefixes the configured API base
 * so the request reaches the backend instead.
 *
 * A URL that is already absolute is returned untouched, so a backend that
 * returns fully-qualified URLs — or a CDN URL — keeps working without the host
 * being doubled up.
 */

/** Matches `http://`, `https://`, protocol-relative `//host`, and `data:`/`blob:`. */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

/**
 * The API origin, with any trailing slash removed.
 *
 * Empty when the dashboard is served from the same host as the API, which is
 * the reverse-proxy deployment: a relative URL is then already correct and is
 * left alone.
 */
function apiBase(): string {
  // Trimmed because a stray space in a `.env` line — `VITE_API_BASE_URL= http://…`
  // — is kept verbatim by Vite, and a URL beginning with a space is treated by
  // the browser as relative, which sends the request to the dashboard's origin
  // instead of the API's. That failure is invisible in the value itself.
  return (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
}

/**
 * Resolves an asset URL from the API for use in `src` or `href`.
 *
 * Returns null for a missing or blank URL so a caller can branch on "no image"
 * rather than rendering an `<img>` with an empty source, which some browsers
 * report as a load error.
 *
 * No token is ever appended: these URLs are public, and putting a bearer token
 * in a query string would leak it into logs, referrers and history.
 */
export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null

  const trimmed = url.trim()
  if (!trimmed) return null

  // Already absolute — including data: and blob: URLs, which a local preview
  // uses and which must never be prefixed.
  if (ABSOLUTE_URL.test(trimmed)) return trimmed

  const base = apiBase()
  if (!base) return trimmed

  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}
