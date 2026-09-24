import { apiGet, http, normaliseError, notifyAuthFailure, UNKNOWN_ERROR } from './client'
import type { ApiResponse, NormalisedError } from '@/types/api'
import type { LogCategory, LogContent, LogContentQuery, LogFile } from '@/types/models'

/**
 * The server's own log files, for diagnosing a problem without shell access.
 *
 * Admin sessions only, gated on `Logs.Read`. Files roll over daily (UTC) and are
 * deleted by retention after a few days, so a listing can go stale while it is open.
 */

/** `GET /api/v1/loyalty/admin/logs` — Logs.Read. Newest first; omit the category for all. */
export function listLogFiles(category?: LogCategory | null): Promise<LogFile[]> {
  return apiGet<LogFile[]>('/api/v1/loyalty/admin/logs', { category })
}

type LogFileRef = Pick<LogFile, 'category' | 'fileName'>

/** Both segments are encoded exactly as the listing returned them. */
function logFilePath(file: LogFileRef): string {
  return (
    '/api/v1/loyalty/admin/logs/' +
    `${encodeURIComponent(file.category)}/${encodeURIComponent(file.fileName)}`
  )
}

/**
 * `GET /api/v1/loyalty/admin/logs/{category}/{fileName}/content` — Logs.Read.
 *
 * The last `tail` lines, optionally only those containing `search`. Cheap enough to
 * poll, which is how the viewer follows a file that is still being written.
 */
export function readLogFile(file: LogFileRef, query: LogContentQuery = {}): Promise<LogContent> {
  return apiGet<LogContent>(`${logFilePath(file)}/content`, { ...query })
}

/** The lines of one request, gathered across a day's application files. */
export type LogTrace = Pick<LogContent, 'lines' | 'totalMatchedLines' | 'truncated'>

/** `-001` rollover suffix, or -1 for the day's first file, so files sort in write order. */
function rolloverIndex(fileName: string): number {
  const match = /-(\d{3})\.log$/.exec(fileName)
  return match ? Number(match[1]) : -1
}

/**
 * Every application-log line written while handling one request.
 *
 * Searches the TraceId in each application file for that UTC day — a busy day rolls
 * over into `-001`, `-002`…, and the request may have been logged in any of them —
 * and joins the matches in write order. A request that crossed midnight UTC is
 * shown only up to midnight.
 */
export async function readRequestTrace(traceId: string, day: string): Promise<LogTrace> {
  const files = (await listLogFiles('application'))
    .filter((file) => file.fileName.startsWith(`app-${day}`))
    .sort((a, b) => rolloverIndex(a.fileName) - rolloverIndex(b.fileName))

  const parts = await Promise.all(
    files.map((file) => readLogFile(file, { search: traceId, tail: 5000 })),
  )

  return {
    lines: parts.flatMap((part) => part.lines),
    totalMatchedLines: parts.reduce((sum, part) => sum + part.totalMatchedLines, 0),
    truncated: parts.some((part) => part.truncated),
  }
}

/**
 * `GET /api/v1/loyalty/admin/logs/{category}/{fileName}` — Logs.Read.
 *
 * The body is the raw file, not an envelope, so this reads it as a blob and checks
 * the status itself: an error body arrives as a blob too, and the response
 * interceptor would otherwise discard the envelope's message. The session handlers
 * are then run by hand so a 401 here still signs the user out.
 */
export async function downloadLogFile(file: LogFileRef): Promise<Blob> {
  let response
  try {
    response = await http.get<Blob>(logFilePath(file), {
      responseType: 'blob',
      // Large files take a while; the instance's 30 s default is for JSON calls.
      timeout: 0,
      validateStatus: () => true,
    })
  } catch (error) {
    throw normaliseError(error)
  }

  if (response.status >= 200 && response.status < 300) {
    return response.data
  }

  const error = await errorFromBlob(response.data, response.status)
  notifyAuthFailure(error)
  throw error
}

async function errorFromBlob(blob: Blob, status: number): Promise<NormalisedError> {
  let envelope: Partial<ApiResponse<unknown>> | null = null
  try {
    envelope = JSON.parse(await blob.text())
  } catch {
    // Not JSON — a proxy's HTML error page, say. The status alone still classifies it.
  }

  return {
    code: envelope?.error?.code ?? UNKNOWN_ERROR,
    message: envelope?.error?.message ?? envelope?.message ?? `Download failed (${status}).`,
    status,
    traceId: envelope?.meta?.traceId ?? null,
    fieldErrors: {},
  }
}
