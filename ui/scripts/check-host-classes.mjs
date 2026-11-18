// The page is styled with the dashboard's own utility classes, and the dashboard
// compiles only the classes ITS sources use: a class this bundle uses that no
// dashboard source uses has no CSS at runtime and silently renders unstyled.
//
// This check reads every class name the built bundle carries and looks each one
// up in a dashboard build's stylesheet. Point it at a Kiro Crew checkout's
// `website/dist` (or a `.css` file) with KIROCREW_DIST; without one it reports
// that it could not run, so a CI without a host build never passes it by accident.
//
//   KIROCREW_DIST=~/github/KiroCrew/website/dist node scripts/check-host-classes.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dist = process.env.KIROCREW_DIST
if (!dist) {
  console.error('check-host-classes: set KIROCREW_DIST to a Kiro Crew website/dist directory (or a .css file)')
  process.exit(2)
}

function cssFiles(path) {
  const full = resolve(path.replace(/^~/, process.env.HOME ?? ''))
  if (statSync(full).isFile()) return [full]
  const assets = join(full, 'assets')
  return readdirSync(assets).filter(f => f.endsWith('.css')).map(f => join(assets, f))
}

const css = cssFiles(dist).map(f => readFileSync(f, 'utf8')).join('\n')
const bundle = readFileSync(new URL('../dist/index.mjs', import.meta.url), 'utf8')

// Class attributes in the compiled JSX: className: "..." and template pieces.
const classes = new Set()
for (const m of bundle.matchAll(/className:\s*(?:"([^"]*)"|`([^`]*)`)/g)) {
  const text = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ')
  for (const c of text.split(/\s+/)) if (c) classes.add(c)
}
// Classes chosen at run time from string literals (`'bg-accent' : 'bg-warn'`):
// a utility family, a hyphen, then its value. Test ids and catalog keys do not
// match this shape.
const RUNTIME = /"((?:bg|text|border|w|h|rounded|animate|grid-cols|md|xl|lg)[-:][A-Za-z0-9:/\[\]().,_-]*)"/g
for (const m of bundle.matchAll(RUNTIME)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c)

// A Tailwind class appears in the stylesheet escaped: `.` `/` `[` `]` `(` `)` `:` `,` `%` are backslashed.
const escape = c => c.replace(/[.:/\[\]()%,]/g, ch => `\\${ch}`)
// `ch-` classes are the app's own (`src/styles.ts`), injected at mount. Run this
// against the OLDEST gateway the app claims to support, not only a dev build: a
// class a newer dashboard happens to use may be absent from the shipped one.
const missing = [...classes].filter(c => !c.startsWith('ch-')).filter(c => !css.includes(`.${escape(c)}`) && !css.includes(`.${escape(c)}{`) && !css.includes(`.${escape(c)},`)).sort()

if (missing.length) {
  console.error(`check-host-classes: ${missing.length} class(es) have no CSS in the host build:`)
  for (const c of missing) console.error(`  ${c}`)
  process.exit(1)
}
console.log(`check-host-classes: all ${classes.size} classes are in the host stylesheet`)
