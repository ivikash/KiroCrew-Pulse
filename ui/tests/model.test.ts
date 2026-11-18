import { describe, expect, it } from 'vitest'
import {
  activeCounts, botCounts, buildFleet, isCommandShaped, offeredOptions, orderFleet, reportsDollars, rowExtras,
  scheduleSummary, spendByModel, splitAttention, upcomingJobs, type RunNode,
} from '../src/model'
import type { ChatSlot, CronJob } from '../src/types'

const node = (id: string, kind: RunNode['kind'], state: RunNode['state']): RunNode =>
  ({ id, kind, state, ref: id, slot: 's', title: id, ordinal: 1 })
const slot = (key: string, over: Partial<ChatSlot> = {}): ChatSlot => ({ key, title: key, ...over })
const job = (over: Partial<CronJob>): CronJob => ({ id: 'j', name: 'Job', enabled: true, last_status: 'ok', ...over })
const NOW = Date.parse('2026-11-18T12:00:00Z')

describe('buildFleet', () => {
  it('reads each session state the way the dashboard does', () => {
    const { nodes } = buildFleet({
      slots: [slot('run', { running: true }), slot('sub', { subagents_running: true }), slot('queued', { queue_depth: 2, queue_held_depth: 1 }),
        slot('held', { queue_depth: 1, queue_held_depth: 1 }), slot('ask', { needs_input: true }), slot('appr', { pending_approval: true }), slot('bot', { mode: 'member' })],
      questions: [], approvals: [], subagents: [], workflows: [],
    }, NOW)
    expect(nodes.map(n => [n.slot, n.state])).toEqual([
      ['run', 'running'], ['sub', 'running'], ['queued', 'running'], ['held', 'idle'], ['ask', 'needs_input'], ['appr', 'needs_input'],
    ])
  })
  it('nests subagents and workflows under their session and drops orphans', () => {
    const { nodes } = buildFleet({
      slots: [slot('a', { title: 'Session A' })], questions: [], approvals: [],
      subagents: [
        { id: 'w1', task: 'Rebase', done: false, parent: 'dashboard:a', last_tool: 'git' },
        { id: 'w2', task: 'w2', done: true, outcome: 'failed', error: 'boom', parent: 'a' },
        { id: 'w3', task: 'Lost', done: false, parent: 'gone' },
        { id: 'w1', task: 'Dup', done: false, parent: 'a' },
      ],
      workflows: [
        { run_id: 'r1', name: 'Nightly', session_key: 'a', status: 'running', last_log: 'Stage 3' },
        { run_id: 'r2', name: 'Old fail', session_key: 'a', status: 'failed', ended_at: '2026-11-10T00:00:00Z' },
        { run_id: 'r3', session_key: 'a', status: 'failed', ended_at: '2026-11-18T11:00:00Z' },
        { run_id: 'r4', session_key: 'a', status: 'paused' },
      ],
    }, NOW)
    expect(nodes.map(n => [n.id, n.state, n.title, n.detail ?? n.error])).toEqual([
      ['session:a', 'idle', 'Session A', undefined],
      ['subagent:w1', 'running', 'Rebase', 'git'],
      ['subagent:w2', 'blocked', '', 'boom'],
      ['workflow:r1', 'running', 'Nightly', 'Stage 3'],
      ['workflow:r2', 'stopped', 'Old fail', undefined],
      ['workflow:r3', 'blocked', '', undefined],
      ['workflow:r4', 'waiting', '', undefined],
    ])
  })
  it('builds the inbox: cards win over options, approvals dedupe, needs-input is its own item', () => {
    const { attention } = buildFleet({
      slots: [
        slot('q', { has_options: true, options: ['A', 'B'] }),
        slot('o', { has_options: true, options: ['Go', '/run'], options_ts: 't1' }),
        slot('busy', { has_options: true, options: ['X'], running: true }),
        slot('ap', { pending_approval: true, pending_approval_info: { request_id: 'r1', origin: 'coordinator' } }),
        slot('ap2', { pending_approval: true }),
        slot('in', { needs_input: true }),
      ],
      questions: [{ slot: 'q', ask_id: 'ask1', questions: [{ question: 'Where?', options: [{ label: 'Here' }] }] }],
      approvals: [{ id: 'r1', instance: 'i1', slot: 'ap', tool: 'shell' }],
      subagents: [], workflows: [],
    }, NOW)
    expect(attention.map(a => [a.kind, a.slot])).toEqual([
      ['question', 'q'], ['follow_up', 'o'], ['approval', 'ap'], ['approval', 'ap2'], ['open_session', 'in'],
    ])
    const follow = attention.find(a => a.kind === 'follow_up')
    expect(follow && follow.kind === 'follow_up' ? follow.followUp.labels : []).toEqual(['Go', '/run'])
  })
})

describe('splitAttention', () => {
  it('folds follow-up offers away and counts questions and approvals', () => {
    const split = splitAttention([
      { id: '1', slot: 's1', kind: 'question', question: { slot: 's1', questions: [] } },
      { id: '2', slot: 's2', kind: 'follow_up', followUp: { slot: 's2', labels: ['A'] } },
      { id: '3', slot: 's3', kind: 'approval' },
      { id: '4', slot: 's4', kind: 'open_session' },
    ])
    expect(split.blockers.map(i => i.slot)).toEqual(['s1', 's3', 's4'])
    expect(split.followUps.map(i => i.slot)).toEqual(['s2'])
    expect(split.questions).toBe(2)
    expect(split.approvals).toBe(1)
  })
})

describe('offeredOptions and isCommandShaped', () => {
  it('offers nothing while the session runs, is interrupted or has a queued prompt', () => {
    expect(offeredOptions(slot('s', { has_options: true, options: ['A', ''] }))).toEqual(['A'])
    expect(offeredOptions(slot('s', { has_options: true, options: ['A'], running: true }))).toEqual([])
    expect(offeredOptions(slot('s', { has_options: true, options: ['A'], interrupted: true }))).toEqual([])
    expect(offeredOptions(slot('s', { has_options: true, options: ['A'], queue_depth: 1 }))).toEqual([])
    expect(offeredOptions(slot('s', { options: ['A'] }))).toEqual([])
  })
  it('withholds labels that would run rather than say', () => {
    expect(isCommandShaped('/deploy')).toBe(true)
    expect(isCommandShaped('  @kiro do it')).toBe(true)
    expect(isCommandShaped('Approve $40 spend')).toBe(true)
    expect(isCommandShaped('Send [ Paste #1 ]')).toBe(true)
    expect(isCommandShaped('Run the a/b test')).toBe(false)
    expect(isCommandShaped('Cost is US$ 40')).toBe(false)
    expect(isCommandShaped('')).toBe(false)
  })
})

describe('activeCounts and orderFleet', () => {
  it('counts only running nodes, by kind', () => {
    expect(activeCounts([node('a', 'session', 'running'), node('b', 'session', 'idle'), node('d', 'subagent', 'running'), node('f', 'workflow', 'running'), node('g', 'workflow', 'waiting')]))
      .toEqual({ sessions: 1, subagents: 1, workflows: 1, total: 3 })
  })
  it('lifts what needs a person first, rests idle, done, stopped and paused workflows', () => {
    const { active, resting } = orderFleet([
      node('idle', 'session', 'idle'), node('run', 'session', 'running'), node('ask', 'session', 'needs_input'),
      node('done', 'subagent', 'done'), node('wait', 'subagent', 'waiting'), node('block', 'subagent', 'blocked'), node('wf', 'workflow', 'waiting'),
    ])
    expect(active.map(n => n.id)).toEqual(['ask', 'block', 'run', 'wait'])
    // A paused workflow ranks as waiting, so it leads the resting list.
    expect(resting.map(n => n.id)).toEqual(['wf', 'idle', 'done'])
  })
  it('lifts a session with an inbox item to needs_input, and only a session', () => {
    const { active } = orderFleet([node('s', 'session', 'idle'), node('w', 'subagent', 'idle')], new Set(['s']))
    expect(active.map(n => [n.id, n.state])).toEqual([['s', 'needs_input']])
  })
})

describe('rowExtras', () => {
  it('reads the run start from last_turn_ts only while the session runs', () => {
    const s = slot('s', { running: true, last_turn_ts: '2026-11-17T12:00:00Z', last_message: '  Writing tests  ', subagents_running: true })
    expect(rowExtras(s)).toEqual({ runningSinceMs: Date.parse('2026-11-17T12:00:00Z'), lastMessage: 'Writing tests', subagentsRunning: true })
    expect(rowExtras({ ...s, running: false }).runningSinceMs).toBeUndefined()
    expect(rowExtras(undefined)).toEqual({ runningSinceMs: undefined, lastMessage: undefined, subagentsRunning: false })
  })
})

describe('schedule', () => {
  const jobs = [
    job({ id: 'late', name: 'Late', next_run_ts: 3_000 }),
    job({ id: 'paused', name: 'Paused', enabled: false, next_run_ts: 1 }),
    job({ id: 'soon', name: 'Soon', next_run_ts: 1_000, last_status: 'error' }),
    job({ id: 'oneshot', name: 'Fired', next_run_ts: null, is_running: true }),
  ]
  it('counts enabled, paused, failing and running jobs and names the soonest forecast run', () => {
    expect(scheduleSummary(jobs)).toEqual({ enabled: 3, paused: 1, failing: 1, running: 1, next: jobs[2] })
  })
  it('lists enabled jobs with a forecast soonest first, up to the limit', () => {
    expect(upcomingJobs(jobs, 5).map(j => j.id)).toEqual(['soon', 'late'])
    expect(upcomingJobs(jobs, 1).map(j => j.id)).toEqual(['soon'])
    expect(scheduleSummary([job({ next_run_ts: null })]).next).toBeNull()
  })
})

describe('botCounts, spendByModel and reportsDollars', () => {
  it('counts crewmates mid-turn over the roster', () => {
    const row = (name: string, running: boolean) => ({ name, slug: name, slot_key: `member-${name}`, running })
    expect(botCounts([row('a', true), row('b', false), row('c', true)])).toEqual({ running: 2, total: 3 })
  })
  const bucket = (cost_usd: number, input: number) => ({ input, output: 0, cache_create: 0, cache_read: 0, cost_usd })
  const models = { a: bucket(4, 10), b: bucket(1, 50), c: bucket(2, 20), d: bucket(0, 0), e: bucket(0.5, 5), f: bucket(0.25, 1) }
  it('measures cost on a dollar-billed harness and tokens otherwise, largest first, dropping empty models', () => {
    expect(spendByModel(models, true, 10, 'other').map(r => [r.model, r.amount])).toEqual([['a', 4], ['c', 2], ['b', 1], ['e', 0.5], ['f', 0.25]])
    expect(spendByModel(models, false, 10, 'other').map(r => r.model)).toEqual(['b', 'c', 'a', 'e', 'f'])
  })
  it('folds the tail into one other row past the limit', () => {
    expect(spendByModel(models, true, 3, 'other')).toEqual([{ model: 'a', amount: 4 }, { model: 'c', amount: 2 }, { model: 'other', amount: 1.75 }])
    expect(spendByModel(undefined, true, 3, 'other')).toEqual([])
  })
  it('names only the claude harness as dollar-billed', () => {
    expect(reportsDollars('claude')).toBe(true)
    expect(reportsDollars('kas')).toBe(false)
    expect(reportsDollars(undefined)).toBe(false)
  })
})
