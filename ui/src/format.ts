/**
 * Locale-aware formatting the host SDK does not export, built on the same
 * `Intl` services the dashboard uses, in the host's active language. The SDK
 * supplies `fmtNumber`, `fmtCurrency`, `fmtTime` and `fmtRelative`; these are
 * the five the page needs beyond them.
 */
import { fmtCurrency, fmtNumber } from '@kirocrew/app-sdk'
import { currentLocale } from './i18n'

/** `1.2K`, `3.4M`: a number abbreviated as the dashboard abbreviates tokens. */
export function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return fmtNumber(value, { notation: 'compact', maximumFractionDigits: 1 })
}

/** The quantity `fmtCompact(value)` shows, for picking a plural form that
 *  agrees with the number on screen: `1.2K` is 1200, so a plural keyed on
 *  1200 is right where one keyed on the exact 1234 might not be. */
export function compactPluralCount(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value
  try {
    const parts = new Intl.NumberFormat(currentLocale(), { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' }).formatToParts(value)
    if (!parts.some(p => p.type === 'compact')) return value
    const integer = parts.filter(p => p.type === 'integer').map(p => p.value).join('')
    const fraction = parts.find(p => p.type === 'fraction')?.value ?? ''
    const shown = Number(`${integer || '0'}.${fraction || '0'}`)
    const digits = Math.floor(Math.log10(Math.abs(value))) - Math.floor(Math.log10(Math.abs(shown)))
    return Math.round(shown * 10 ** digits)
  } catch {
    return value
  }
}

/** `a, b, and c` in the locale's own list style. */
export function fmtList(items: readonly string[]): string {
  const kept = items.filter(Boolean)
  try {
    return new Intl.ListFormat(currentLocale(), { type: 'conjunction', style: 'long' }).format(kept)
  } catch {
    return kept.join(', ')
  }
}

/** `42%`, floored so a share at 99.6% does not read as the whole. */
export function fmtPercentFloor(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  const floored = Math.floor(ratio * 100) / 100
  return fmtNumber(floored, { style: 'percent', maximumFractionDigits: 0 })
}

/** A dollar figure the way the dashboard writes cost: `~$0` for nothing,
 *  `<$0.01` under a cent, otherwise the locale's currency form. */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return '—'
  if (usd === 0) return '~$0'
  const abs = Math.abs(usd)
  const sign = usd < 0 ? '-' : ''
  if (abs < 0.01) return `${sign}<${fmtCurrency(0.01)}`
  return `${sign}${fmtCurrency(abs)}`
}

/** A run's age as whole hours and minutes (`2h 5m`, `7m`), the way a glance
 *  reads it; `0m` for a run under a minute. */
export function fmtElapsedMinutes(sinceMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - sinceMs) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const unit = (n: number, u: 'hour' | 'minute') => fmtNumber(n, { style: 'unit', unit: u, unitDisplay: 'narrow' })
  if (!hours) return unit(rest, 'minute')
  return rest ? `${unit(hours, 'hour')} ${unit(rest, 'minute')}` : unit(hours, 'hour')
}
