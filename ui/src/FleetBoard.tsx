/**
 * The agent board: one row per session with its subagents and workflows nested
 * under it, each with an activity track over a rolling window (6, 12 or 24
 * hours). Rows come in reading order (what needs a person, then blocked,
 * working, waiting); sessions wholly at rest fold behind a count so the board
 * stays as long as the work, not as long as the history.
 */
import { Fragment, useState } from 'react'
import { fmtNumber, fmtTime } from '@kirocrew/app-sdk'
import { Badge, Btn, Card, EmptyState } from '@kirocrew/app-sdk/ui'
import { Radar } from 'lucide-react'
import ActivityTrack, { type TrackMarker } from './ActivityTrack'
import { fmtElapsedMinutes } from './format'
import { t } from './i18n'
import { orderFleet, type RowExtras, type RunKind, type RunNode, type RunState } from './model'
import { useTurnHistory } from './queries'
import { RowLink, Section, sessionRoute } from './rows'
import { TIMELINE_HOURS, pointOn, spanOn, tickTimes, timelineWindow, turnSpans, type TimelineHours, type TimelineWindow, type TrackSpan } from './timeline'
import type { SubagentInfo } from './types'

type BadgeVariant = 'ok' | 'err' | 'warn' | 'aim' | 'muted'

/** The state's badge tint and wording. `needs_input` reuses the inbox's label,
 *  so the row and the section it points at say the same thing. */
const STATE: Record<RunState, { variant: BadgeVariant; key: string }> = {
  needs_input: { variant: 'warn', key: 'commandCenter.attention_filter' },
  blocked: { variant: 'err', key: 'commandCenter.blocked' },
  running: { variant: 'aim', key: 'commandCenter.running' },
  waiting: { variant: 'muted', key: 'pages.homePage.state_waiting' },
  idle: { variant: 'muted', key: 'commandCenter.idle' },
  done: { variant: 'ok', key: 'pages.homePage.state_done' },
  stopped: { variant: 'muted', key: 'pages.homePage.state_stopped' },
}
const KIND_KEY: Record<RunKind, string> = { session: 'pages.homePage.kind_session', subagent: 'pages.homePage.kind_subagent', workflow: 'pages.homePage.kind_workflow' }
const LABEL_KEY: Record<RunKind, string> = { session: 'commandCenter.session_label', subagent: 'commandCenter.worker_label', workflow: 'commandCenter.workflow_label' }
const AXIS_TICKS = 6

/** The node's name, or the dashboard's numbered placeholder for an unnamed one. */
function runTitle(node: RunNode): string {
  return node.title || t(LABEL_KEY[node.kind], { number: fmtNumber(node.ordinal) })
}

/** Badge, text, track, link: the board's four columns, shared by every row and
 *  by the axis under them so the tracks and the tick marks line up. */
const COLUMNS = 'ch-board-cols items-center gap-3'

interface Track { spans: TrackSpan[]; live: TrackSpan | null; markers: TrackMarker[] }

function RowText({ node, extras, nowMs }: { node: RunNode; extras?: RowExtras; nowMs: number }) {
  // Under the title: an error first, then the current step or tool, then the
  // agent's last words.
  const line = node.error || node.detail || (node.kind === 'session' ? extras?.lastMessage : undefined)
  const running = node.state === 'running'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2 min-w-0">
        <span className={`${node.kind === 'session' ? 'text-sm font-medium' : 'text-[13px]'} truncate max-w-full`}>{runTitle(node)}</span>
        {node.kind !== 'session' && <span className="text-[11px] text-muted shrink-0">{t(KIND_KEY[node.kind])}</span>}
        {running && extras?.runningSinceMs != null && <span className="text-[11px] text-muted shrink-0" data-testid="home-fleet-elapsed">{t('pages.homePage.running_for', { duration: fmtElapsedMinutes(extras.runningSinceMs, nowMs) })}</span>}
        {node.kind === 'session' && extras?.subagentsRunning && <span className="text-[11px] text-muted shrink-0">{t('pages.homePage.with_subagents')}</span>}
      </div>
      {line && <div className={`text-[12px] truncate ${node.error ? 'text-danger-text' : 'text-muted'}`}>{line}</div>}
    </div>
  )
}

function BoardRow({ node, extras, timeline, track, child = false }: { node: RunNode; extras?: RowExtras; timeline: TimelineWindow; track: Track; child?: boolean }) {
  const state = STATE[node.state]
  return (
    <li className={child ? 'py-1.5 pl-6 border-t border-border/60' : 'py-2 border-t border-border first:border-t-0'} data-testid="home-fleet-row" data-state={node.state}>
      <div className={`grid ${COLUMNS}`}>
        <Badge variant={state.variant} className="shrink-0">
          {!child && node.state === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1 align-middle" />}
          {t(state.key)}
        </Badge>
        <RowText node={node} extras={extras} nowMs={timeline.endMs} />
        <div className="hidden md:block min-w-0"><ActivityTrack spans={track.spans} live={track.live} markers={track.markers} thin={child} label={runTitle(node)} /></div>
        <RowLink to={sessionRoute(node.slot)}>{t('commandCenter.open_session')}</RowLink>
      </div>
    </li>
  )
}

/** A session's track: its turns from the usage store (read while the row is
 *  drawn), the live run from the slot's own clock, and a dot at "now" when it
 *  waits on a decision or failed. */
function SessionRow({ node, extras, timeline, drawn }: { node: RunNode; extras?: RowExtras; timeline: TimelineWindow; drawn: boolean }) {
  const turns = useTurnHistory(node.slot, timeline.endMs, drawn)
  const markers: TrackMarker[] = []
  if (node.state === 'needs_input') markers.push({ atPct: 100, kind: 'ask' })
  if (node.error || node.state === 'blocked') markers.push({ atPct: 100, kind: 'error' })
  const track: Track = {
    spans: turnSpans(turns.data ?? [], timeline),
    live: node.state === 'running' && extras?.runningSinceMs != null ? spanOn(timeline, extras.runningSinceMs, timeline.endMs) : null,
    markers,
  }
  return <BoardRow node={node} extras={extras} timeline={timeline} track={track} />
}

/** A subagent's track: a live span from its start to now while it runs. The
 *  gateway records no end time for a finished run, so a finished row draws no
 *  span (a bar to "now" would claim work that stopped long ago); a failed one
 *  marks where it began, the one instant known. A workflow carries no clock and
 *  draws only its state. */
function ChildRow({ node, agent, timeline }: { node: RunNode; agent?: SubagentInfo; timeline: TimelineWindow }) {
  const startMs = agent?.started ? agent.started * 1000 : undefined
  const live = node.state === 'running' && startMs !== undefined ? spanOn(timeline, startMs, timeline.endMs) : null
  const failed = !!node.error || node.state === 'blocked'
  const failedAt = failed ? (startMs === undefined ? 100 : (pointOn(timeline, startMs) ?? (startMs < timeline.startMs ? 0 : 100))) : null
  const track: Track = { spans: [], live, markers: failedAt === null ? [] : [{ atPct: failedAt, kind: 'error' }] }
  return <BoardRow node={node} timeline={timeline} track={track} child />
}

interface Group { session: RunNode; children: RunNode[] }

function groupBySession(nodes: readonly RunNode[]): Group[] {
  const groups = new Map<string, Group>()
  for (const n of nodes) if (n.kind === 'session') groups.set(n.slot, { session: n, children: [] })
  for (const n of nodes) if (n.kind !== 'session') groups.get(n.slot)?.children.push(n)
  return [...groups.values()]
}

function Axis({ timeline }: { timeline: TimelineWindow }) {
  const ticks = tickTimes(timeline, AXIS_TICKS)
  return (
    <div className={`hidden md:grid ${COLUMNS} text-[11px] text-muted pt-1`} aria-hidden="true">
      <span /><span />
      <div className="relative h-4">
        {ticks.map((at, i) => <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / AXIS_TICKS) * 100}%` }}>{fmtTime(at)}</span>)}
        <span className="absolute right-0 font-medium text-text">{t('pages.homePage.now')}</span>
      </div>
      <span />
    </div>
  )
}

export default function FleetBoard({ nodes, attentionSlots, extras, subagents, ready, nowMs }: {
  nodes: readonly RunNode[]
  attentionSlots: ReadonlySet<string>
  extras: ReadonlyMap<string, RowExtras>
  subagents: readonly SubagentInfo[]
  ready: boolean
  nowMs: number
}) {
  const [hours, setHours] = useState<TimelineHours>(12)
  // Resting rows read their turns only while the fold is open.
  const [restingOpen, setRestingOpen] = useState(false)
  const timeline = timelineWindow(hours, nowMs)
  const agentById = new Map(subagents.map(a => [a.id, a]))
  const { active, resting } = orderFleet(nodes, attentionSlots)
  // A session is drawn in the active list when it or anything under it is active.
  const activeSlots = new Set(active.map(n => n.slot))
  const activeGroups = groupBySession([...active, ...resting]).filter(g => activeSlots.has(g.session.slot))
  const restingGroups = groupBySession(resting).filter(g => !activeSlots.has(g.session.slot))
  const renderGroup = (g: Group, drawn: boolean) => (
    <Fragment key={g.session.id}>
      <SessionRow node={g.session} extras={extras.get(g.session.slot)} timeline={timeline} drawn={drawn} />
      {g.children.map(c => <ChildRow key={c.id} node={c} agent={c.kind === 'subagent' ? agentById.get(c.ref) : undefined} timeline={timeline} />)}
    </Fragment>
  )
  return (
    <Section label={t('pages.homePage.fleet_title')} count={ready ? fmtNumber(activeGroups.length) : undefined} testId="home-fleet"
      trailing={(
        <div className="flex items-center gap-1" role="group" aria-label={t('pages.homePage.window_label')}>
          {TIMELINE_HOURS.map(h => (
            <Btn key={h} primary={h === hours} aria-pressed={h === hours} className="px-2 py-0.5 text-[11px]" onClick={() => setHours(h)} data-testid={`home-window-${h}`}>
              {t('pages.homePage.window_hours', { count: h, amount: fmtNumber(h) })}
            </Btn>
          ))}
        </div>
      )}>
      <Card className="py-1">
        {ready && !nodes.length && <EmptyState icon={<Radar size={24} />} title={t('pages.sessionsPage.empty_title')} testId="home-fleet-empty" />}
        {activeGroups.length > 0 && <ul className="list-none m-0 p-0" data-testid="home-fleet-active">{activeGroups.map(g => renderGroup(g, true))}</ul>}
        {ready && !activeGroups.length && nodes.length > 0 && <p className="text-sm text-muted py-2">{t('pages.homePage.fleet_all_resting')}</p>}
        {nodes.length > 0 && <Axis timeline={timeline} />}
        {restingGroups.length > 0 && (
          <details className="text-sm border-t border-border pt-2 mt-1" data-testid="home-fleet-resting" onToggle={e => setRestingOpen(e.currentTarget.open)}>
            <summary className="cursor-pointer text-muted">{t('pages.homePage.fleet_resting', { count: restingGroups.length, amount: fmtNumber(restingGroups.length) })}</summary>
            <ul className="list-none m-0 p-0">{restingGroups.map(g => renderGroup(g, restingOpen))}</ul>
          </details>
        )}
      </Card>
    </Section>
  )
}
