/**
 * The badge each run state wears: its tint and its catalog key. One table, so
 * the board rows and the Needs-you cards say the same word in the same colour
 * for the same state. `needs_input` reuses the inbox's own label, so the row and
 * the section it points at agree.
 */
import type { RunState } from './model'

export type BadgeVariant = 'ok' | 'err' | 'warn' | 'aim' | 'muted'

export interface StateBadge { variant: BadgeVariant; key: string }

export const STATE: Record<RunState, StateBadge> = {
  needs_input: { variant: 'warn', key: 'commandCenter.attention_filter' },
  blocked: { variant: 'err', key: 'commandCenter.blocked' },
  running: { variant: 'aim', key: 'commandCenter.running' },
  waiting: { variant: 'muted', key: 'pages.homePage.state_waiting' },
  idle: { variant: 'muted', key: 'commandCenter.idle' },
  done: { variant: 'ok', key: 'pages.homePage.state_done' },
  stopped: { variant: 'muted', key: 'pages.homePage.state_stopped' },
}

/** The badge a card wears once its answer or decision has gone out. */
export const SENT: StateBadge = { variant: 'ok', key: 'pulse.sent' }
