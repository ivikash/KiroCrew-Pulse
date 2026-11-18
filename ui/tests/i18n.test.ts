import { describe, expect, it } from 'vitest'
import { CATALOGS, localeChain, t } from '../src/i18n'
import { compactPluralCount, fmtCompact, fmtElapsedMinutes, fmtList, fmtPercentFloor, formatCost } from '../src/format'
import { stubLocale } from './stubs/app-sdk'

type Catalog = { [key: string]: string | Catalog }
function flat(c: Catalog, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(c)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.set(key, v)
    else for (const [kk, vv] of flat(v, key)) out.set(kk, vv)
  }
  return out
}
const PLURAL = /_(zero|one|two|few|many|other)$/
const base = (key: string) => key.replace(PLURAL, '')
const PLACEHOLDERS = /\{\{\s*(\w+)\s*\}\}/g
const names = (text: string) => [...text.matchAll(PLACEHOLDERS)].map(m => m[1]).sort()

describe('catalogs', () => {
  const en = flat(CATALOGS.en)
  const enBases = new Set([...en.keys()].map(base))
  it('ship the twelve dashboard locales', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual(['bn', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'ru', 'zh-CN'])
  })
  it.each(Object.keys(CATALOGS))('%s carries every English key with the same placeholders', locale => {
    const cat = flat(CATALOGS[locale])
    const bases = new Set([...cat.keys()].map(base))
    expect([...enBases].filter(k => !bases.has(k))).toEqual([])
    expect([...bases].filter(k => !enBases.has(k))).toEqual([])
    for (const [key, text] of cat) {
      // Each locale's `_other` (or the sole form) carries what English's does.
      const ref = en.get(key) ?? en.get(`${base(key)}_other`) ?? en.get(base(key))
      if (ref !== undefined && names(ref).length) expect(names(text), key).toEqual(names(ref))
    }
  })
})

describe('t', () => {
  it('falls back from a regional locale to its base, then English, then the key', () => {
    expect(localeChain('zh-CN')).toEqual(['zh-CN', 'en'])
    expect(localeChain('pt-BR')).toEqual(['pt', 'en'])
    expect(localeChain('xx')).toEqual(['en'])
    stubLocale('pt-BR')
    expect(t('pages.homePage.open')).toBe(flat(CATALOGS.pt).get('pages.homePage.open'))
    expect(t('no.such.key')).toBe('no.such.key')
  })
  it('selects plural forms by the locale rules and fills placeholders', () => {
    expect(t('pages.homePage.subagents', { count: 1, amount: '1' })).toBe('1 subagent')
    expect(t('pages.homePage.subagents', { count: 3, amount: '3' })).toBe('3 subagents')
    stubLocale('ru')
    expect(t('pages.homePage.subagents', { count: 2, amount: '2' })).toBe(flat(CATALOGS.ru).get('pages.homePage.subagents_few')!.replace('{{amount}}', '2'))
    expect(t('pulse.wants_to_run', { tool: 'shell' })).toContain('shell')
    expect(t('pulse.wants_to_run')).toContain('{{tool}}')
  })
})

describe('format', () => {
  it('abbreviates and picks the shown quantity for plurals', () => {
    expect(fmtCompact(1234)).toBe('1.2K')
    expect(fmtCompact(Number.NaN)).toBe('—')
    expect(compactPluralCount(1234)).toBe(1200)
    expect(compactPluralCount(15)).toBe(15)
    expect(compactPluralCount(0)).toBe(0)
  })
  it('writes lists, floors percentages and formats cost as the dashboard does', () => {
    expect(fmtList(['a', '', 'b', 'c'])).toBe('a, b, and c')
    expect(fmtPercentFloor(0.996)).toBe('99%')
    expect(formatCost(0)).toBe('~$0')
    expect(formatCost(0.004)).toBe('<$0.01')
    expect(formatCost(8.38)).toBe('$8.38')
    expect(formatCost(-1.5)).toBe('-$1.50')
    expect(formatCost(undefined)).toBe('—')
  })
  it('writes a run age in hours and minutes', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    expect(fmtElapsedMinutes(now - 7 * 60_000, now)).toBe('7m')
    expect(fmtElapsedMinutes(now - 125 * 60_000, now)).toBe('2h 5m')
    expect(fmtElapsedMinutes(now - 120 * 60_000, now)).toBe('2h')
    expect(fmtElapsedMinutes(now + 60_000, now)).toBe('0m')
  })
})
