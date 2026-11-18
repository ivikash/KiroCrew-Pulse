/**
 * The right column: where today's usage went (by model), the next jobs due,
 * and the Bots roster. Each reads one gateway list and links to the dashboard
 * page that owns it.
 */
import { fmtNumber, fmtRelative } from '@kirocrew/app-sdk'
import { Badge, Card, EmptyState, ErrorNotice } from '@kirocrew/app-sdk/ui'
import { Bot, CalendarDays } from 'lucide-react'
import { fmtCompact, fmtPercentFloor, formatCost } from './format'
import { t } from './i18n'
import { botCounts, spendByModel, upcomingJobs } from './model'
import { ListRow, RowLink, Section } from './rows'
import type { CronJob, MemberRow, ModelTokens, UsageReport } from './types'

/** Theme tints for the bar's segments, largest share first. */
const SEGMENT_CLASSES = ['bg-accent', 'bg-accent/70', 'ch-accent-45', 'bg-accent/25', 'bg-border-strong']

/** How many upcoming jobs the section lists; the Schedule page has the rest. */
const UPCOMING_LIMIT = 5

export function Spend({ models, usage, dollars }: { models: Record<string, ModelTokens> | undefined; usage: UsageReport | undefined; dollars: boolean }) {
  const rows = spendByModel(models, dollars, SEGMENT_CLASSES.length, t('pages.homePage.spend_other'))
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const amount = (n: number) => dollars ? formatCost(n) : t('pages.overviewPage.today_tokens', { count: n, amount: fmtCompact(n) })
  const plan = usage?.billing
  const percent = plan?.credits_plan ? ((plan.credits_used ?? 0) / plan.credits_plan) : undefined
  return (
    <Section label={t('pages.homePage.spend_title')} count={usage ? amount(total) : undefined} testId="home-spend"
      trailing={<RowLink to="/settings/overview?view=usage">{t('pages.homePage.open_page')}</RowLink>}>
      <Card className="space-y-3">
        {usage && !rows.length && <EmptyState icon={null} title={t('pages.homePage.spend_none')} testId="home-spend-empty" />}
        {rows.length > 0 && <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated" role="img" aria-label={t('pages.homePage.spend_bar_label')} data-testid="home-spend-bar">
            {rows.map((r, i) => <span key={r.model} className={SEGMENT_CLASSES[i]} style={{ width: `${(r.amount / total) * 100}%` }} data-testid="home-spend-segment" />)}
          </div>
          <ul className="list-none m-0 p-0 space-y-1.5">
            {rows.map((r, i) => (
              <li key={r.model} className="flex items-center gap-2 min-w-0 text-[13px]" data-testid="home-spend-row">
                <span className={`w-2 h-2 rounded-full shrink-0 ${SEGMENT_CLASSES[i]}`} />
                <span className="flex-1 min-w-0 truncate">{r.model}</span>
                <span className="text-muted tabular-nums shrink-0">{fmtPercentFloor(r.amount / total)}</span>
                <span className="tabular-nums shrink-0 w-20 text-right">{amount(r.amount)}</span>
              </li>
            ))}
          </ul>
        </>}
        {plan?.plan && percent !== undefined && (
          <div className="text-[12px] text-muted">{t('pages.homePage.spend_plan', { plan: plan.plan, percent: fmtPercentFloor(percent), amount: fmtNumber(Math.floor(percent * 100)) })}</div>
        )}
      </Card>
    </Section>
  )
}

/** `jobs` is undefined while the list loads or when its read failed; the page's
 *  own notice says so, and this card stays quiet rather than saying it twice. */
export function Schedule({ jobs }: { jobs: readonly CronJob[] | undefined }) {
  const upcoming = jobs ? upcomingJobs(jobs, UPCOMING_LIMIT) : []
  return (
    <Section label={t('pages.homePage.upcoming')} count={jobs ? fmtNumber(upcoming.length) : undefined} testId="home-schedule"
      trailing={<RowLink to="/schedule">{t('pages.homePage.open_page')}</RowLink>}>
      <Card className="py-1">
        {jobs && !upcoming.length && <EmptyState icon={<CalendarDays size={24} />} title={t('pages.homePage.no_next_run')} testId="home-schedule-empty" />}
        {upcoming.length > 0 && (
          <ul className="list-none m-0 p-0">
            {upcoming.map(job => (
              <ListRow key={job.id} data-testid="home-schedule-row">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{job.name}</div>
                  <div className="text-[12px] text-muted truncate">{t('pages.homePage.due', { when: fmtRelative(job.next_run_ts * 1000) })}</div>
                </div>
                {job.is_running ? <Badge variant="ok">{t('pages.schedulePage.running')}</Badge>
                  : job.last_status === 'error' ? <Badge variant="err">{t('pages.schedulePage.error')}</Badge> : null}
                <RowLink to={`/schedule?job=${encodeURIComponent(job.id)}`}>{t('pages.homePage.open')}</RowLink>
              </ListRow>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  )
}

export function Bots({ rows, error }: { rows: readonly MemberRow[] | undefined; error: boolean }) {
  const counts = botCounts(rows ?? [])
  // Working crewmates first, then the most recently active.
  const ordered = [...(rows ?? [])].sort((a, b) => Number(b.running) - Number(a.running) || (b.last_active_ts ?? 0) - (a.last_active_ts ?? 0))
  return (
    <Section label={t('nav.crew_members')} count={rows ? t('pages.homePage.bots_count', { running: fmtNumber(counts.running), total: fmtNumber(counts.total) }) : undefined} testId="home-bots"
      trailing={<RowLink to="/members">{t('pages.homePage.open_page')}</RowLink>}>
      <Card className="py-1">
        <ErrorNotice message={error ? t('pages.homePage.bots_unavailable') : undefined} />
        {rows && !rows.length && <EmptyState icon={<Bot size={24} />} title={t('pages.membersPage.empty_title')} testId="home-bots-empty" />}
        {ordered.length > 0 && (
          <ul className="list-none m-0 p-0">
            {ordered.map(row => (
              <ListRow key={row.slug} data-testid="home-bot-row" data-running={row.running ? 'true' : 'false'}>
                <span className={`w-7 h-7 rounded-full shrink-0 grid place-items-center text-[12px] font-semibold ${row.running ? 'bg-accent text-accent-fg' : 'bg-bg-elevated text-muted'}`} aria-hidden="true">
                  {(row.display_name ?? row.name).slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{row.display_name ?? row.name}</div>
                  {row.last_active_ts != null && <div className="text-[12px] text-muted truncate">{t('pages.homePage.last_active', { when: fmtRelative(row.last_active_ts * 1000) })}</div>}
                </div>
                <Badge variant={row.running ? 'aim' : 'muted'} className="shrink-0">{t(row.running ? 'commandCenter.running' : 'commandCenter.idle')}</Badge>
                <RowLink to={`/members?member=${encodeURIComponent(row.name)}`}>{t('pages.homePage.open')}</RowLink>
              </ListRow>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  )
}
