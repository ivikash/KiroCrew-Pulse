/**
 * The pieces every Pulse list shares: a section with its header line, a row
 * that separates from the one above it, and the accent "Open" link on its right.
 * One definition, so the board, the inbox, the roster and the schedule cannot
 * drift apart.
 */
import type { ReactNode } from 'react'
import { useNavigate } from '@kirocrew/app-sdk'
import { ArrowUpRight } from 'lucide-react'

export function Section({ label, count, trailing, children, testId }: {
  label: string
  /** A number or short figure beside the label; absent while it loads. */
  count?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  testId: string
}) {
  return (
    <section aria-label={label} className="space-y-3" data-testid={testId}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12.5px] font-semibold text-text-strong">{label}</span>
        {count !== undefined && <span className="text-[12px] text-muted tabular-nums" data-testid={`${testId}-count`}>{count}</span>}
        <span className="flex-1 border-t border-border" aria-hidden="true" />
        {trailing}
      </div>
      {children}
    </section>
  )
}

export function ListRow({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  return <li className={`flex items-center gap-3 min-w-0 py-2 border-t border-border first:border-t-0 ${className}`} {...rest}>{children}</li>
}

/** A link into the dashboard, through the host's router so the page does not reload. */
export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <a
      href={to}
      onClick={e => { e.preventDefault(); navigate(to) }}
      className="text-accent text-[12px] inline-flex min-h-8 items-center gap-1 shrink-0 no-underline"
    >
      {children}<ArrowUpRight size={13} />
    </a>
  )
}

/** The chat route for a session. */
export const sessionRoute = (slot: string) => `/chat?sid=${encodeURIComponent(slot)}`
