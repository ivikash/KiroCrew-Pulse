/**
 * A stat tile: label, number, and the one-line detail under it. The host's
 * `StatCard` has no detail line on every gateway this app supports, so the tile
 * is drawn here with the same classes the host's card uses, plus the detail.
 */
import type { ReactNode } from 'react'
import { Card } from '@kirocrew/app-sdk/ui'

export default function Tile({ label, value, detail, accent = false, colorClass, testId }: {
  label: string
  /** Undefined while the sources load: a skeleton takes the number's place. */
  value: ReactNode | undefined
  detail?: string
  accent?: boolean
  colorClass?: string
  testId: string
}) {
  return (
    <Card className="min-w-0" data-testid={testId}>
      <div className="text-muted text-[13px] font-medium uppercase tracking-[.04em]" data-testid="stat-card-label">{label}</div>
      {value === undefined
        ? <div className="skeleton h-7 w-16 mt-1.5 rounded" data-testid="stat-card-skeleton" />
        : <div className={`text-2xl font-bold mt-1.5 tracking-tight leading-none ${accent ? 'text-accent' : colorClass ?? ''}`} data-testid="stat-card-value">{value}</div>}
      {detail && <div className="text-[12px] text-muted mt-2 truncate" title={detail} data-testid="stat-card-detail">{detail}</div>}
    </Card>
  )
}
