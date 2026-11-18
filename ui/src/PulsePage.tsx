/**
 * Pulse: mission control for the crew on one page. What is running, what is
 * waiting on a person, what is scheduled, and what today has cost, each read
 * from the gateway list the dashboard page for it reads, so Home cannot
 * disagree with the page it links to.
 *
 * Layout: a stat strip, then the agent board with the Needs-you inbox under it
 * on the left; today's spend, the upcoming jobs and the Bots on the right.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtNumber, fmtRelative } from '@kirocrew/app-sdk'
import { ErrorNotice, PageHeader } from '@kirocrew/app-sdk/ui'
import FleetBoard from './FleetBoard'
import NeedsYou from './NeedsYou'
import Tile from './Tile'
import { Bots, Schedule, Spend } from './SidePanels'
import { compactPluralCount, fmtCompact, fmtElapsedMinutes, fmtList, formatCost } from './format'
import { t } from './i18n'
import { activeCounts, buildFleet, reportsDollars, rowExtras, scheduleSummary, splitAttention, tokensOf, type RowExtras, type RunNode } from './model'
import { approvalsQuery, configQuery, cronsQuery, membersQuery, questionsQuery, slotsQuery, statusQuery, subagentsQuery, useFleetRefresh, useMinuteClock, usageQuery, workflowsQuery } from './queries'
import { RowLink } from './rows'

const EMPTY: never[] = []

/** The Today line: sessions and messages, then tokens and cost when known. */
function todayLine(sessions: number | undefined, messages: number | undefined, tokens: number | undefined, cost: number | undefined): string {
  const count = (n: number | undefined) => ({ count: compactPluralCount(n ?? 0), amount: fmtCompact(n ?? Number.NaN) })
  const parts = [t('pages.overviewPage.today_sessions', count(sessions)), t('pages.overviewPage.today_messages', count(messages))]
  if (tokens !== undefined) parts.push(t('pages.overviewPage.today_tokens', count(tokens)))
  if (cost !== undefined) parts.push(formatCost(cost))
  return t('pages.overviewPage.today_line', { summary: parts.join(' · ') })
}

function uptimeLine(startSec: number | undefined, version: string | undefined, nowMs: number): string {
  const uptime = startSec ? fmtElapsedMinutes(startSec * 1000, nowMs) : '—'
  return version ? t('pages.overviewPage.uptime_line_version', { uptime, version }) : t('pages.overviewPage.uptime_line', { uptime })
}

export default function PulsePage() {
  useFleetRefresh()
  const nowMs = useMinuteClock()
  const slots = useQuery(slotsQuery)
  const questions = useQuery(questionsQuery)
  const approvals = useQuery(approvalsQuery)
  const subagents = useQuery(subagentsQuery)
  const workflows = useQuery(workflowsQuery)
  const crons = useQuery(cronsQuery)
  const members = useQuery(membersQuery)
  const usage = useQuery(usageQuery)
  const status = useQuery(statusQuery)
  const config = useQuery(configQuery)

  const fleet = useMemo(() => buildFleet({
    slots: slots.data ?? EMPTY, questions: questions.data ?? EMPTY, approvals: approvals.data ?? EMPTY,
    subagents: subagents.data ?? EMPTY, workflows: workflows.data ?? EMPTY,
  }, nowMs), [slots.data, questions.data, approvals.data, subagents.data, workflows.data, nowMs])
  const attention = useMemo(() => splitAttention(fleet.attention), [fleet.attention])
  const sessions = useMemo(() => new Map<string, RunNode>(fleet.nodes.filter(n => n.kind === 'session').map(n => [n.slot, n])), [fleet.nodes])
  const slotByKey = useMemo(() => new Map((slots.data ?? EMPTY).map(s => [s.key, s])), [slots.data])
  const extras = useMemo(() => new Map<string, RowExtras>((slots.data ?? EMPTY).map(s => [s.key, rowExtras(s)])), [slots.data])
  const attentionSlots = useMemo(() => new Set(attention.blockers.map(a => a.slot)), [attention.blockers])

  // The counts show once the slot list and both decision reads have answered.
  const ready = slots.isSuccess && questions.isFetched && approvals.isFetched
  const active = activeCounts(fleet.nodes)
  const activeDetail = fmtList([
    t('pages.overviewPage.today_sessions', { count: active.sessions, amount: fmtNumber(active.sessions) }),
    t('pages.homePage.subagents', { count: active.subagents, amount: fmtNumber(active.subagents) }),
    t('pages.homePage.workflows', { count: active.workflows, amount: fmtNumber(active.workflows) }),
  ])
  // The tile counts everything waiting on a person; its detail line says how
  // much of that is a blocker (a question or approval) and how much an offer.
  const waiting = attention.blockers.length + attention.followUps.length
  const attentionDetail = !waiting ? t('commandCenter.no_input') : [
    attention.blockers.length
      ? fmtList([
        t('pages.homePage.questions_count', { count: attention.questions, amount: fmtNumber(attention.questions) }),
        t('pages.homePage.approvals_count', { count: attention.approvals, amount: fmtNumber(attention.approvals) }),
      ])
      : '',
    attention.followUps.length ? t('pages.homePage.suggestions_count', { count: attention.followUps.length, amount: fmtNumber(attention.followUps.length) }) : '',
  ].filter(Boolean).join(' · ')

  const schedule = crons.data ? scheduleSummary(crons.data) : undefined
  const scheduleDetail = schedule && [
    schedule.next ? t('pages.homePage.next_run', { name: schedule.next.name, when: fmtRelative(schedule.next.next_run_ts * 1000) }) : t('pages.homePage.no_next_run'),
    schedule.failing ? t('pages.homePage.failing_count', { count: schedule.failing, amount: fmtNumber(schedule.failing) }) : '',
    schedule.paused ? t('pages.homePage.paused_count', { count: schedule.paused, amount: fmtNumber(schedule.paused) }) : '',
  ].filter(Boolean).join(' · ')

  // Today leads with cost on a dollar-billed harness, otherwise the day's session
  // count. Which one waits for the config read, so the tile never flips meaning.
  const dollars = reportsDollars(config.data?.agent?.acp_backend)
  const report = usage.data
  const todayBucket = report?.local_day ? report.tokens?.daily_history?.find(d => d.date === report.local_day) : undefined
  const todayTokens = dollars && todayBucket ? tokensOf({ input: todayBucket.input, output: todayBucket.output, cache_create: todayBucket.cache_creation, cache_read: todayBucket.cache_read }) : undefined
  const todayCost = dollars ? todayBucket?.cost_usd : undefined
  const todayValue = usage.isError ? '—'
    : !report || config.isPending ? undefined
      : dollars ? formatCost(todayCost ?? 0) : fmtCompact(report.sessions?.today?.sessions ?? 0)
  const todayDetail = report ? todayLine(report.sessions?.today?.sessions, report.sessions?.today?.messages, todayTokens, todayCost) : undefined

  const sourceError = slots.isError ? t('pulse.sessions_unavailable')
    : (questions.isError || approvals.isError || subagents.isError || workflows.isError) ? t('commandCenter.stale') : undefined
  const connected = status.isSuccess

  return (
    <>
      <PageHeader title={t('pulse.title')} subtitle={t('pages.homePage.subtitle')} />
      <div className="px-4 md:px-6 pb-8 overflow-y-auto flex-1 min-h-0 space-y-4">
        <ErrorNotice message={sourceError} />
        <ErrorNotice message={crons.isError ? t('pages.homePage.schedule_unavailable') : undefined} />
        <div className="grid ch-tiles gap-3" data-testid="home-stat-strip">
          <Tile testId="home-stat-active" label={t('pages.homePage.active_now')} value={ready ? fmtNumber(active.total) : undefined} detail={activeDetail} accent={active.total > 0} />
          <Tile testId="home-stat-attention" label={t('commandCenter.attention_filter')} value={ready ? fmtNumber(waiting) : undefined} detail={attentionDetail} colorClass={waiting ? 'text-warn-text' : undefined} />
          <Tile testId="home-stat-schedule" label={t('pages.homePage.scheduled')} value={schedule ? fmtNumber(schedule.enabled) : crons.isError ? '—' : undefined} detail={scheduleDetail} colorClass={schedule?.failing ? 'text-danger-text' : undefined} />
          <Tile testId="home-stat-today" label={t('pages.homePage.today')} value={todayValue} detail={todayDetail} />
        </div>
        <div className="grid ch-page-cols gap-4 items-start">
          <div className="space-y-4 min-w-0">
            <FleetBoard nodes={fleet.nodes} attentionSlots={attentionSlots} extras={extras} subagents={subagents.data ?? EMPTY} ready={ready} nowMs={nowMs} />
            <NeedsYou attention={attention} sessions={sessions} slots={slotByKey} ready={ready} />
          </div>
          <div className="space-y-4 min-w-0">
            <Spend models={todayBucket?.models} usage={report} dollars={dollars} />
            <Schedule jobs={crons.data} />
            <Bots rows={members.data} error={members.isError} />
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted" data-testid="gateway-health-line">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-ok' : 'bg-warn'}`} />
            <span className="text-text font-medium">{connected ? t('pages.overviewPage.all_systems_running') : status.isError ? t('pulse.gateway_unreachable') : t('pages.overviewPage.connecting')}</span>
            {connected && <><span aria-hidden="true">·</span><span>{uptimeLine(status.data?.start_time, status.data?.version, nowMs)}</span></>}
          </div>
          <RowLink to="/settings/overview">{t('pages.homePage.open_overview')}</RowLink>
        </footer>
      </div>
    </>
  )
}
