/**
 * Pulse's numbers, as pure functions over the gateway payloads the page
 * reads. Nothing here touches React or the network, so every rule is testable
 * on fixtures.
 *
 * The fleet model (one node per session, subagent and workflow, with a state
 * each) follows the dashboard's own command-center rules, so a session reads
 * the same here as on All Dashboards: `needs_input` when a question, approval
 * or needs-input flag waits on a person, `running` when its turn, a subagent
 * or a queued prompt is moving, `idle` otherwise.
 */
import type { ChatSlot, CronJob, MemberRow, ModelTokens, PendingApproval, PendingQuestion, SubagentInfo, WorkflowRun } from './types'

export type RunState = 'running' | 'idle' | 'done' | 'blocked' | 'waiting' | 'needs_input' | 'stopped'
export type RunKind = 'session' | 'subagent' | 'workflow'

export interface RunNode {
  id: string
  kind: RunKind
  ref: string
  slot: string
  /** The session, task or workflow name; empty when the source carries none. */
  title: string
  ordinal: number
  state: RunState
  detail?: string
  error?: string
}

/** A follow-up ask built from a session's newest reply ending in `[OPTIONS:]`:
 *  the agent offered next steps and nothing is stuck. */
export interface FollowUp {
  slot: string
  labels: string[]
}

export type AttentionItem =
  | { id: string; slot: string; kind: 'question'; question: PendingQuestion }
  | { id: string; slot: string; kind: 'approval'; approval?: PendingApproval }
  | { id: string; slot: string; kind: 'open_session' }
  | { id: string; slot: string; kind: 'follow_up'; followUp: FollowUp }

export interface FleetSources {
  slots: readonly ChatSlot[]
  questions: readonly PendingQuestion[]
  approvals: readonly PendingApproval[]
  subagents: readonly SubagentInfo[]
  workflows: readonly WorkflowRun[]
}

export interface Fleet {
  nodes: RunNode[]
  attention: AttentionItem[]
}

/** How long a failed workflow counts as blocked. Past it the run rests as
 *  stopped; the Workflows page still lists it. */
const FAILED_WORKFLOW_BLOCKED_MS = 24 * 60 * 60 * 1000

/** Session keys from the workflow and spawn APIs may be scope-qualified;
 *  slot keys are not. */
export function slotKey(key: string): string {
  return key.startsWith('dashboard:') ? key.slice('dashboard:'.length) : key
}

/** A session a person opened, as opposed to a Bot's pinned thread (listed under
 *  Bots) or a slot with no key. */
function isBoardSlot(slot: ChatSlot): boolean {
  return !!slot.key && slot.mode !== 'member'
}

/** The dashboard's placeholder title for a session nobody named yet. */
function sessionTitle(slot: ChatSlot): string {
  const title = slot.title?.trim() ?? ''
  return title && title !== slot.key ? title : ''
}

/** The choices an idle session's newest reply offers, or none when it is not
 *  waiting on them: the session is running or interrupted, or a queued prompt
 *  may already be the answer. */
export function offeredOptions(slot: ChatSlot): string[] {
  const offered = slot.has_options ? (slot.options ?? []).filter(Boolean) : []
  if (!offered.length || slot.running || slot.interrupted || (slot.queue_depth ?? 0) > 0) return []
  return offered
}

/** A `$name` token loads a skill body from anywhere in a sent string; the
 *  dashboard's send path reads the same pattern. */
const SKILL_TOKEN_RE = /(?<![\w$])\$[a-z0-9][a-z0-9/_-]*/

/** A label that, sent bare, would run rather than say: one opening with a
 *  harness command or mention sigil, or carrying a skill or paste token. The
 *  dashboard's own rule (`dispatchIsCommandShaped`); such a label is answered in
 *  the session itself, never from here. */
export function isCommandShaped(label: string): boolean {
  const text = label.trim()
  if (!text) return false
  if (text.startsWith('/') || text.startsWith('@')) return true
  if (SKILL_TOKEN_RE.test(text)) return true
  return text.includes('[ Paste #')
}

function failedWorkflowState(endedAt: string | null | undefined, now: number): RunState {
  const ended = endedAt ? Date.parse(endedAt) : Number.NaN
  return Number.isFinite(ended) && now - ended > FAILED_WORKFLOW_BLOCKED_MS ? 'stopped' : 'blocked'
}

function subagentState(agent: SubagentInfo): RunState {
  if (agent.done) {
    if (agent.outcome === 'failed' || agent.error) return 'blocked'
    if (agent.outcome === 'stopped' || agent.stopped) return 'stopped'
    return 'done'
  }
  if (agent.stopped) return 'stopped'
  if (agent.awaiting_approval) return 'needs_input'
  return 'running'
}

function workflowState(run: WorkflowRun, now: number): RunState {
  switch (run.status) {
    case 'finished': return 'done'
    case 'failed': return failedWorkflowState(run.ended_at, now)
    case 'cancelled': return 'stopped'
    case 'paused':
    case 'pausing': return 'waiting'
    case 'running':
    case 'planning':
    case 'planned': return 'running'
    default: return 'idle'
  }
}

/** Every node and every item that needs a person, from the five reads. */
export function buildFleet(source: FleetSources, now = Date.now()): Fleet {
  const slots = source.slots.filter(isBoardSlot)
  const keys = new Set(slots.map(s => s.key))
  const attention: AttentionItem[] = []
  const seen = new Set<string>()
  const add = (item: AttentionItem) => {
    if (!seen.has(item.id)) { seen.add(item.id); attention.push(item) }
  }
  const has = (slot: string, kind: AttentionItem['kind']) => attention.some(a => a.slot === slot && a.kind === kind)

  for (const q of source.questions) {
    const slot = slotKey(q.slot)
    if (keys.has(slot)) add({ id: `question:${slot}:${q.ask_id || q.card_id || slot}`, slot, kind: 'question', question: q })
  }
  // A real question card for the same session wins over its `[OPTIONS:]` line.
  for (const s of slots) {
    const offered = offeredOptions(s)
    if (!offered.length || has(s.key, 'question')) continue
    add({ id: `options:${s.key}:${s.options_ts ?? ''}:${offered.join('\u0000')}`, slot: s.key, kind: 'follow_up', followUp: { slot: s.key, labels: offered } })
  }
  for (const approval of source.approvals) {
    const slot = slotKey(approval.slot ?? '')
    if (keys.has(slot)) add({ id: `approval:${slot}:${approval.id}:${approval.instance ?? ''}`, slot, kind: 'approval', approval })
  }
  for (const s of slots) {
    if (s.pending_approval && !has(s.key, 'approval')) add({ id: `session-approval:${s.key}`, slot: s.key, kind: 'approval' })
    if (s.needs_input && !attention.some(a => a.slot === s.key && a.kind !== 'follow_up')) add({ id: `session-input:${s.key}`, slot: s.key, kind: 'open_session' })
  }

  const nodes: RunNode[] = slots.map((s, index) => ({
    id: `session:${s.key}`, kind: 'session', ref: s.key, slot: s.key, title: sessionTitle(s), ordinal: index + 1,
    state: s.needs_input || s.pending_approval ? 'needs_input'
      : s.running || s.subagents_running || (s.queue_depth ?? 0) - (s.queue_held_depth ?? 0) > 0 ? 'running' : 'idle',
    detail: s.todo?.current || undefined,
  }))
  const agentIds = new Set<string>()
  for (const a of source.subagents) {
    const slot = slotKey(a.parent ?? '')
    if (!keys.has(slot) || agentIds.has(a.id)) continue
    agentIds.add(a.id)
    nodes.push({ id: `subagent:${a.id}`, kind: 'subagent', ref: a.id, slot, title: a.task !== a.id ? a.task : '', ordinal: nodes.length + 1,
      state: subagentState(a), detail: a.last_tool || undefined, error: a.error || undefined })
  }
  for (const w of source.workflows) {
    const slot = slotKey(w.session_key ?? '')
    if (!keys.has(slot)) continue
    nodes.push({ id: `workflow:${w.run_id}`, kind: 'workflow', ref: w.run_id, slot, title: w.name && w.name !== w.run_id ? w.name : '', ordinal: nodes.length + 1,
      state: workflowState(w, now), detail: w.last_log, error: w.error || undefined })
  }
  return { nodes, attention }
}

/** What needs a person, split by weight. A BLOCKER (question, approval,
 *  needs-input session) stops its session until someone answers. A follow-up
 *  offer stops nothing. Only blockers count on the tile. */
export interface AttentionSplit {
  blockers: AttentionItem[]
  followUps: Extract<AttentionItem, { kind: 'follow_up' }>[]
  questions: number
  approvals: number
}

export function splitAttention(items: readonly AttentionItem[]): AttentionSplit {
  const followUps = items.filter((i): i is Extract<AttentionItem, { kind: 'follow_up' }> => i.kind === 'follow_up')
  const blockers = items.filter(i => i.kind !== 'follow_up')
  return {
    blockers,
    followUps,
    questions: blockers.filter(i => i.kind === 'question' || i.kind === 'open_session').length,
    approvals: blockers.filter(i => i.kind === 'approval').length,
  }
}

/** The slot facts a board row shows beside the node's own: when the current
 *  run started and what the agent last said. `last_turn_ts` moves when a prompt
 *  arrives or a turn ends, so on a running session it is when the run began. */
export interface RowExtras { runningSinceMs?: number; lastMessage?: string; subagentsRunning: boolean }

export function rowExtras(slot: ChatSlot | undefined): RowExtras {
  const since = slot?.running && slot.last_turn_ts ? Date.parse(slot.last_turn_ts) : Number.NaN
  return {
    runningSinceMs: Number.isNaN(since) ? undefined : since,
    lastMessage: slot?.last_message?.trim() || undefined,
    subagentsRunning: !!slot?.subagents_running,
  }
}

/** Running work by kind: the tile's number is `total`, its detail the breakdown. */
export interface ActiveCounts { sessions: number; subagents: number; workflows: number; total: number }

export function activeCounts(nodes: readonly RunNode[]): ActiveCounts {
  const running = nodes.filter(n => n.state === 'running')
  const by = (kind: RunKind) => running.filter(n => n.kind === kind).length
  return { sessions: by('session'), subagents: by('subagent'), workflows: by('workflow'), total: running.length }
}

/** Reading order: what a person must act on first, then what is blocked, then
 *  what is working; the rest is at rest. Ties keep source order. */
const STATE_RANK: Record<RunState, number> = { needs_input: 0, blocked: 1, running: 2, waiting: 3, idle: 4, done: 5, stopped: 6 }
const RESTING: ReadonlySet<RunState> = new Set(['idle', 'done', 'stopped'])

/** A paused workflow waits on nobody, so it rests. */
function isResting(node: RunNode): boolean {
  return RESTING.has(node.state) || (node.kind === 'workflow' && node.state === 'waiting')
}

/** Nodes in reading order, split into the ones worth a row and the ones at
 *  rest. A session with a blocker in the inbox reads `needs_input` whatever its
 *  flags say, so the row never contradicts the card beside it. */
export function orderFleet(nodes: readonly RunNode[], attentionSlots: ReadonlySet<string> = new Set()): { active: RunNode[]; resting: RunNode[] } {
  const lifted = nodes.map(n => n.kind === 'session' && attentionSlots.has(n.slot) && n.state !== 'needs_input' ? { ...n, state: 'needs_input' as const } : n)
  const sorted = lifted.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state])
  return { active: sorted.filter(n => !isResting(n)), resting: sorted.filter(isResting) }
}

/** The Scheduled tile: how many jobs can fire, how many are paused or failing,
 *  and the next one due. */
export interface ScheduleSummary { enabled: number; paused: number; failing: number; running: number; next: UpcomingJob | null }

export function scheduleSummary(jobs: readonly CronJob[]): ScheduleSummary {
  const enabled = jobs.filter(j => j.enabled)
  return {
    enabled: enabled.length,
    paused: jobs.length - enabled.length,
    failing: enabled.filter(j => j.last_status === 'error').length,
    running: jobs.filter(j => j.is_running).length,
    next: upcomingJobs(jobs, 1)[0] ?? null,
  }
}

/** A job the gateway has forecast a next run for. */
export type UpcomingJob = CronJob & { next_run_ts: number }

/** Enabled jobs with a forecast run, soonest first. */
export function upcomingJobs(jobs: readonly CronJob[], limit: number): UpcomingJob[] {
  return jobs
    .filter((j): j is UpcomingJob => j.enabled && typeof j.next_run_ts === 'number')
    .sort((a, b) => a.next_run_ts - b.next_run_ts)
    .slice(0, limit)
}

/** The Bots panel's count: crewmates mid-turn over the roster size. */
export function botCounts(rows: readonly MemberRow[]): { running: number; total: number } {
  return { running: rows.filter(r => r.running).length, total: rows.length }
}

/** One model's share of today's usage: cost on a dollar-billed harness, tokens otherwise. */
export interface SpendRow { model: string; amount: number }

export function tokensOf(bucket: ModelTokens): number {
  return (bucket.input ?? 0) + (bucket.output ?? 0) + (bucket.cache_create ?? 0) + (bucket.cache_read ?? 0)
}

/** Today's usage by model, largest first, the smallest folded into one "other"
 *  row once there are more than `limit`. A model with nothing to show is dropped. */
export function spendByModel(models: Record<string, ModelTokens> | undefined, dollars: boolean, limit: number, otherLabel: string): SpendRow[] {
  const measure = (b: ModelTokens) => dollars ? (b.cost_usd ?? 0) : tokensOf(b)
  const rows = Object.entries(models ?? {})
    .map(([model, bucket]) => ({ model, amount: measure(bucket) }))
    .filter(r => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  if (rows.length <= limit) return rows
  const kept = rows.slice(0, limit - 1)
  return [...kept, { model: otherLabel, amount: rows.slice(limit - 1).reduce((sum, r) => sum + r.amount, 0) }]
}

/** The harnesses whose turns record a dollar cost. Every other harness reports
 *  tokens, so the Today tile and the spend panel show tokens there. */
const DOLLAR_HARNESSES: readonly string[] = ['claude']

export function reportsDollars(backend: string | undefined): boolean {
  return backend !== undefined && DOLLAR_HARNESSES.includes(backend)
}
