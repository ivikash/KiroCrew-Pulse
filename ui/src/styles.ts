/**
 * The few rules the dashboard's stylesheet cannot be relied on for.
 *
 * The page is styled with the dashboard's own utility classes, which the
 * dashboard compiles only for the class names ITS sources use. An arbitrary
 * grid template or a tint the dashboard happens not to use would have no CSS at
 * runtime, and a dashboard release could drop one the page relied on. So the
 * page's own grid shapes (the stat strip, the two-column page, the board) and tints live here, under `ch-` names, painted from
 * the theme's variables so they follow every theme. Injected once per document.
 */

const STYLE_ID = 'crew-pulse-styles'

const CSS = `
.ch-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 768px) { .ch-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.ch-page-cols { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1280px) { .ch-page-cols { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); } }
.ch-board-cols { grid-template-columns: auto minmax(0, 1fr) auto; }
@media (min-width: 768px) { .ch-board-cols { grid-template-columns: auto minmax(0, 5fr) minmax(0, 4fr) auto; } }
.ch-accent-50 { background-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.ch-accent-45 { background-color: color-mix(in srgb, var(--accent) 45%, transparent); }
`

export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  doc.head.appendChild(style)
}
