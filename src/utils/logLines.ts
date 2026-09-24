import type { LogEntry, LogLevel } from '@/types/models'

/**
 * Reading the server's JSON log lines for display.
 *
 * Parsing never throws: a line cut off mid-write at the end of today's file, or one
 * written before the structured format, is kept as raw text so one bad line cannot
 * break the viewer.
 */

export type ParsedLogLine =
  | { kind: 'entry'; raw: string; entry: LogEntry }
  | { kind: 'raw'; raw: string }

export function parseLogLine(raw: string): ParsedLogLine {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { kind: 'entry', raw, entry: parsed as LogEntry }
    }
  } catch {
    // Falls through to raw text.
  }
  return { kind: 'raw', raw }
}

/** Shown in the row itself, or not worth showing, so left out of the details list. */
const BASE_FIELDS = new Set(['timestamp', 'level', 'category', 'message', 'eventId', 'exception'])

/** Every other structured value, for the expanded row. */
export function extraFields(entry: LogEntry): [string, unknown][] {
  return Object.entries(entry).filter(([key]) => !BASE_FIELDS.has(key))
}

/** The class name at the end of a logger category, as a short "source". */
export function shortSource(category: string | undefined): string {
  if (!category) return ''
  return category.split('.').pop() || category
}

const LEVEL_RANK: Record<LogLevel, number> = {
  Trace: 0,
  Debug: 1,
  Information: 2,
  Warning: 3,
  Error: 4,
  Critical: 5,
}

/** Unknown levels rank lowest, so a level filter hides them rather than guessing. */
export function levelRank(level: string | undefined): number {
  return LEVEL_RANK[level as LogLevel] ?? -1
}

export const MIN_RANK = { all: -Infinity, warning: LEVEL_RANK.Warning, error: LEVEL_RANK.Error } as const
export type LevelFilter = keyof typeof MIN_RANK

export function levelVariant(level: string | undefined): 'neutral' | 'info' | 'warning' | 'danger' {
  switch (level) {
    case 'Information':
      return 'info'
    case 'Warning':
      return 'warning'
    case 'Error':
    case 'Critical':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function statusVariant(status: number | undefined): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === undefined) return 'neutral'
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  if (status >= 200 && status < 300) return 'success'
  return 'neutral'
}

/** The UTC day a timestamp falls on, as log file names spell it: `YYYYMMDD`. */
export function logDay(timestamp: string): string | null {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/** A structured value as text: strings verbatim, anything else as JSON. */
export function fieldText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return ''
  return JSON.stringify(value)
}
