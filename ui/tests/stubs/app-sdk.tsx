/**
 * A light stand-in for the host's `@kirocrew/app-sdk`: only the names the bundle
 * uses, with the host's documented behaviour where a test depends on it. The
 * `stub*` exports are test controls; no host module has them.
 *
 * `useAppApi()` answers from `stubRoutes`: a test sets the JSON each GET path
 * returns and records every POST, so a page test drives the real query layer
 * with no network.
 */
import { vi } from 'vitest'
import type { AppApi, NumberOptions } from '@kirocrew/app-sdk'

let locale = 'en'
export function stubLocale(next: string): void { locale = next }
export function activeLocale(): string { return locale }

/** GET path (without query) → body, or an Error to reject with. */
export const stubRoutes = new Map<string, unknown>()
/** Every POST the page sent, in order. */
export const stubPosts: { path: string; body: unknown }[] = []
export const stubNavigate = vi.fn<(path: string) => void>()
/** The `slots` event listeners the page registered. */
export const stubListeners = new Map<string, Set<(data: unknown) => void>>()

export function resetStubSdk(): void {
  locale = 'en'
  stubRoutes.clear()
  stubPosts.length = 0
  stubNavigate.mockReset()
  stubListeners.clear()
}

export function fireStubEvent(event: string, data: unknown = null): void {
  for (const cb of stubListeners.get(event) ?? []) cb(data)
}

class ScopedError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`)
    this.name = 'AppApiError'
    this.status = status
    this.body = body
  }
}

async function get<T>(path: string): Promise<T> {
  const key = path.split('?')[0]
  if (!stubRoutes.has(key)) throw new ScopedError(404, `no stub for ${key}`)
  const value = stubRoutes.get(key)
  if (value instanceof Error) throw value
  return value as T
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  stubPosts.push({ path, body })
  const key = `POST ${path.split('?')[0]}`
  const value = stubRoutes.get(key)
  if (value instanceof Error) throw value
  return (value ?? {}) as T
}

const unstubbed = () => Promise.reject(new Error('stub app-sdk: method not stubbed'))

const API: AppApi = { raw: unstubbed as AppApi['raw'], request: unstubbed, get, post, put: unstubbed, patch: unstubbed, del: unstubbed }

export function useAppApi(): AppApi { return API }
export function useLanguageGeneration(): number { return 0 }
export function useNavigate(): (path: string) => void { return stubNavigate }
export function useAppEvents(event: string, cb: (data: unknown) => void): void {
  if (!stubListeners.has(event)) stubListeners.set(event, new Set())
  stubListeners.get(event)!.add(cb)
}

export function fmtNumber(value: number, options?: NumberOptions): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, options).format(value)
}
export function fmtCurrency(value: number, currency = 'USD', options?: NumberOptions): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }).format(value)
}
export function fmtTime(value: Date | number | string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(value))
}
export function fmtRelative(value: Date | number | string): string {
  const diffMin = Math.round((new Date(value).getTime() - Date.now()) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  return Math.abs(diffMin) >= 60 ? rtf.format(Math.round(diffMin / 60), 'hour') : rtf.format(diffMin, 'minute')
}
