import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The manifest and the bundle are two halves of one contract: every path the
 * page calls is declared, nothing declared goes unused, and the bundle imports
 * only the modules the dashboard's import map provides.
 */
// Vitest runs from `ui/`; the manifest sits one level up.
const at = (rel: string) => resolve(process.cwd(), '..', rel)
const manifest = JSON.parse(readFileSync(at('app.json'), 'utf8')) as {
  name: string; version: string; permissions: { api: string[]; events: string[] }; ui: { entry: string; pages: { route: string }[] }
}
const apiSource = readFileSync(at('ui/src/api.ts'), 'utf8')
const queriesSource = readFileSync(at('ui/src/queries.ts'), 'utf8')

/** The paths `api.ts` calls, with their encoded segments reduced to a prefix. */
function calledPaths(): string[] {
  const out = new Set<string>()
  for (const m of apiSource.matchAll(/(?:get|post)(?:<[^>]*>)?\(\s*[`'"]([^`'"?]+)/g)) {
    out.add(m[1].replace(/\$\{[^}]*\}.*$/, '').replace(/\/$/, ''))
  }
  return [...out].sort()
}

/** Whether a declared pattern admits a path, by the SDK's own rules. */
function admits(pattern: string, path: string): boolean {
  if (pattern.startsWith('=')) return pattern.slice(1) === path
  if (pattern.endsWith('/*')) { const b = pattern.slice(0, -2); return path === b || path.startsWith(b + '/') }
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1))
  return path === pattern || path.startsWith(pattern + '/')
}

describe('app.json', () => {
  it('has a kebab-case name, a semver version and a /apps/<name> page', () => {
    expect(manifest.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(manifest.ui.entry).toBe('dist/index.mjs')
    expect(manifest.ui.pages[0].route).toBe(`/apps/${manifest.name}`)
  })
  it('declares every path the page calls, and nothing it does not', () => {
    const called = calledPaths()
    expect(called.length).toBeGreaterThan(8)
    for (const path of called) {
      expect(manifest.permissions.api.some(p => admits(p, path)), `${path} is not declared`).toBe(true)
    }
    for (const pattern of manifest.permissions.api) {
      expect(called.some(path => admits(pattern, path)), `${pattern} is declared but never called`).toBe(true)
    }
  })
  it('subscribes only to the slots event, which needs no scope', () => {
    const events = [...queriesSource.matchAll(/useAppEvents\('([^']+)'/g)].map(m => m[1])
    expect(events).toEqual(['slots'])
    expect(manifest.permissions.events).toEqual(['slots'])
  })
})

describe('dist/index.mjs', () => {
  it('imports only the modules the dashboard provides', () => {
    const bundle = readFileSync(at('ui/dist/index.mjs'), 'utf8')
    const imports = [...bundle.matchAll(/^import\b[^;]*?from\s*"([^"]+)"/gm)].map(m => m[1]).sort()
    expect(new Set(imports)).toEqual(new Set(['react', 'react/jsx-runtime', 'lucide-react', '@tanstack/react-query', '@kirocrew/app-sdk', '@kirocrew/app-sdk/ui']))
  })
})
