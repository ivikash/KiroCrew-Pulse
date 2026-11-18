/**
 * The "Needs you" inbox. A BLOCKER (a question card, a tool approval, a session
 * marked needs-input) gets a card that answers or decides it from here, routed to
 * the same gateway endpoints the dashboard's own cards use. A follow-up offer
 * (an idle session whose newest reply ended in `[OPTIONS:]`) is one compact row
 * behind a fold: nothing is stuck, and a full card per offer buried the blockers
 * under a screen of buttons.
 *
 * Nothing here sends on a click alone: a pick stays a draft until "Send answer",
 * and an approval needs its own button. A label the dashboard would refuse to
 * send bare (one that reads as a command) is withheld with a note to answer in
 * the session.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fmtNumber } from '@kirocrew/app-sdk'
import { Btn, Card, EmptyState, ErrorNotice } from '@kirocrew/app-sdk/ui'
import { Inbox, MessageSquare } from 'lucide-react'
import { approvalTarget, writes, type ApprovalAction } from './api'
import { t } from './i18n'
import { isCommandShaped, type AttentionItem, type AttentionSplit, type RunNode } from './model'
import { LIVE_KEYS } from './queries'
import { ListRow, RowLink, Section, sessionRoute } from './rows'
import type { ChatSlot, PendingQuestion, QuestionPrompt } from './types'

/** Blocker cards per step: one row of the widest grid at first, and each
 *  "Show more" adds another row. */
const BLOCKERS_PER_ROW = 3

function useLiveInvalidate() {
  const client = useQueryClient()
  return () => { for (const key of LIVE_KEYS) void client.invalidateQueries({ queryKey: key }) }
}

function errorLine(err: unknown, fallbackKey: string): string {
  const status = (err as { status?: number } | null)?.status
  if (status === 404 || status === 409 || status === 410) return t('components.approvalCard.approval_no_longer_pending')
  const message = err instanceof Error ? err.message : ''
  return message ? t('components.approvalCard.decision_not_recorded_error', { error: message }) : t(fallbackKey)
}

function CardShell({ title, slot, children }: { title: string; slot: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3" data-testid="home-attention-card">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="text-sm font-medium min-w-0 break-words">{title}</div>
        <RowLink to={sessionRoute(slot)}>{t('commandCenter.open_session')}</RowLink>
      </div>
      <p className="text-[12px] text-muted m-0">{t('commandCenter.explicit_input')}</p>
      {children}
    </Card>
  )
}

/** One prompt's choices and a free-text line; the draft is the caller's. */
function Prompt({ prompt, value, onChange }: { prompt: QuestionPrompt; value: string; onChange: (next: string) => void }) {
  const picks = new Set(value.split('\n').filter(Boolean))
  const toggle = (label: string) => {
    if (prompt.multiSelect) {
      const next = new Set(picks)
      if (next.has(label)) next.delete(label); else next.add(label)
      onChange([...next].join('\n'))
    } else {
      onChange(picks.has(label) && picks.size === 1 ? '' : label)
    }
  }
  const custom = [...picks].some(p => !prompt.options.some(o => o.label === p)) ? value : ''
  return (
    <div className="rounded-lg bg-accent-subtle p-3 space-y-2" data-testid="home-question-prompt">
      <div className="text-sm font-medium">{prompt.question}</div>
      <div className="grid gap-2">
        {prompt.options.map(o => (
          <button key={o.label} type="button" aria-pressed={picks.has(o.label)} onClick={() => toggle(o.label)}
            className={`text-left text-sm rounded-md border px-3 py-2 ${picks.has(o.label) ? 'border-accent bg-accent/15' : 'border-border bg-card'}`}>
            <div>{o.label}</div>
            {o.description && <div className="text-[12px] text-muted">{o.description}</div>}
          </button>
        ))}
        <input type="text" value={custom} onChange={e => onChange(e.target.value)} placeholder={t('components.questionCard.or_type_a_custom_answer')}
          className="text-sm rounded-md border border-border bg-card px-3 py-2 min-w-0" aria-label={t('components.questionCard.or_type_a_custom_answer')} />
      </div>
    </div>
  )
}

function QuestionCard({ item, title }: { item: Extract<AttentionItem, { kind: 'question' }>; title: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const refresh = useLiveInvalidate()
  const question: PendingQuestion = item.question
  const mutation = useMutation({
    mutationFn: (payload: Record<string, string>) => writes.answer(question.ask_id!, payload),
    onSuccess: refresh,
  })
  const complete = question.questions.every(q => (answers[q.question] ?? '').trim())
  // A stateless card (no ask_id) blocks nothing the gateway can receive from
  // here: its answer is typed in the session.
  if (!question.ask_id) {
    return (
      <CardShell title={title} slot={item.slot}>
        <div className="text-sm">{question.questions[0]?.question}</div>
        <RowLink to={sessionRoute(item.slot)}>{t('pulse.answer_in_session')}</RowLink>
      </CardShell>
    )
  }
  return (
    <CardShell title={title} slot={item.slot}>
      {question.questions.map(q => (
        <Prompt key={q.question} prompt={q} value={answers[q.question] ?? ''} onChange={next => setAnswers(a => ({ ...a, [q.question]: next }))} />
      ))}
      <ErrorNotice message={mutation.isError ? errorLine(mutation.error, 'pulse.answer_failed') : undefined} />
      <div className="flex justify-end">
        <Btn primary disabled={!complete || mutation.isPending} onClick={() => mutation.mutate(Object.fromEntries(Object.entries(answers).map(([q, a]) => [q, a.trim()])))} data-testid="home-send-answer">
          <MessageSquare size={14} className="lucide-inline" /> {t('commandCenter.send_answer')}
        </Btn>
      </div>
    </CardShell>
  )
}

function ApprovalCard({ item, title, slot }: { item: Extract<AttentionItem, { kind: 'approval' }>; title: string; slot: ChatSlot | undefined }) {
  const refresh = useLiveInvalidate()
  const target = approvalTarget(item.slot, item.approval, slot?.pending_approval_info)
  const tool = item.approval?.tool ?? slot?.pending_approval_info?.tool ?? ''
  const purpose = item.approval?.tool_purpose ?? slot?.pending_approval_info?.tool_purpose
  const input = item.approval?.tool_input ?? slot?.pending_approval_info?.tool_input
  const mutation = useMutation({
    mutationFn: (action: ApprovalAction) => writes.decide(target!, action),
    onSuccess: refresh,
  })
  return (
    <CardShell title={title} slot={item.slot}>
      <div className="rounded-lg bg-warn-subtle p-3 space-y-1" data-testid="home-approval">
        <div className="text-sm font-medium">{tool ? t('pulse.wants_to_run', { tool }) : t('pulse.approval_pending')}</div>
        {purpose && <div className="text-[12px] text-muted">{purpose}</div>}
        {typeof input === 'string' && input && <code className="block text-[12px] break-all whitespace-pre-wrap">{input}</code>}
      </div>
      <ErrorNotice message={mutation.isError ? errorLine(mutation.error, 'components.approvalCard.decision_failed') : undefined} />
      {target ? (
        <div className="flex justify-end gap-2" role="group" aria-label={t('commandCenter.attention_filter')}>
          <Btn disabled={mutation.isPending} onClick={() => mutation.mutate('reject_once')} title={t('commandCenter.reject_help')} data-testid="home-reject">{t('commandCenter.reject')}</Btn>
          <Btn primary disabled={mutation.isPending} onClick={() => mutation.mutate('approve')} data-testid="home-approve">{t('commandCenter.approve')}</Btn>
        </div>
      ) : (
        // The slot row names no request this page can decide: the session's own card does.
        <RowLink to={sessionRoute(item.slot)}>{t('pulse.answer_in_session')}</RowLink>
      )}
    </CardShell>
  )
}

function OpenSessionCard({ item, title, detail }: { item: AttentionItem; title: string; detail?: string }) {
  return (
    <CardShell title={title} slot={item.slot}>
      {detail && <div className="text-sm text-muted">{detail}</div>}
      <RowLink to={sessionRoute(item.slot)}>{t('pulse.answer_in_session')}</RowLink>
    </CardShell>
  )
}

/** A follow-up offer: pick a label and send it as the session's next message. */
function FollowUpRow({ item, title }: { item: Extract<AttentionItem, { kind: 'follow_up' }>; title: string }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState('')
  const refresh = useLiveInvalidate()
  const mutation = useMutation({ mutationFn: (label: string) => writes.send(item.slot, label), onSuccess: refresh })
  const sendable = item.followUp.labels.filter(l => !isCommandShaped(l))
  const choices = item.followUp.labels.length
  return (
    <ListRow className="py-1.5 flex-wrap" data-testid="home-suggestion-row">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{title}</div>
        <div className="text-[12px] text-muted truncate">{t('pages.homePage.suggestion_choices', { count: choices, amount: fmtNumber(choices) })}</div>
      </div>
      {sendable.length > 0 && <Btn className="text-[12px]" aria-expanded={open} onClick={() => setOpen(o => !o)} data-testid="home-suggestion-toggle">{t('commandCenter.options_question')}</Btn>}
      <RowLink to={sessionRoute(item.slot)}>{t('pages.homePage.open')}</RowLink>
      {open && (
        <div className="basis-full rounded-lg bg-accent-subtle p-3 space-y-2" data-testid="home-suggestion-picks">
          <div className="grid gap-2">
            {sendable.map(label => (
              <button key={label} type="button" aria-pressed={pick === label} onClick={() => setPick(p => p === label ? '' : label)}
                className={`text-left text-sm rounded-md border px-3 py-2 ${pick === label ? 'border-accent bg-accent/15' : 'border-border bg-card'}`}>{label}</button>
            ))}
          </div>
          <ErrorNotice message={mutation.isError ? errorLine(mutation.error, 'pulse.answer_failed') : undefined} />
          <div className="flex justify-end">
            <Btn primary disabled={!pick || mutation.isPending} onClick={() => mutation.mutate(pick)} data-testid="home-suggestion-send">{t('commandCenter.send_answer')}</Btn>
          </div>
        </div>
      )}
    </ListRow>
  )
}

export default function NeedsYou({ attention, sessions, slots, ready }: {
  attention: AttentionSplit
  sessions: ReadonlyMap<string, RunNode>
  slots: ReadonlyMap<string, ChatSlot>
  ready: boolean
}) {
  const [visible, setVisible] = useState(BLOCKERS_PER_ROW)
  const title = (slot: string) => { const n = sessions.get(slot); return n ? (n.title || slot) : slot }
  const { blockers, followUps } = attention
  const shown = blockers.slice(0, visible)
  const hidden = blockers.length - shown.length
  const nextStep = Math.min(hidden, BLOCKERS_PER_ROW)
  const empty = ready && !blockers.length && !followUps.length
  return (
    <Section label={t('commandCenter.attention_filter')} count={fmtNumber(blockers.length)} testId="home-needs-you">
      {shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start" data-testid="home-needs-you-grid">
          {shown.map(item => {
            if (item.kind === 'question') return <QuestionCard key={item.id} item={item} title={title(item.slot)} />
            if (item.kind === 'approval') return <ApprovalCard key={item.id} item={item} title={title(item.slot)} slot={slots.get(item.slot)} />
            return <OpenSessionCard key={item.id} item={item} title={title(item.slot)} detail={sessions.get(item.slot)?.detail} />
          })}
        </div>
      )}
      {hidden > 0 && <Btn onClick={() => setVisible(v => v + BLOCKERS_PER_ROW)} data-testid="home-needs-you-more">{t('pages.homePage.show_more_blockers', { count: nextStep, amount: fmtNumber(nextStep) })}</Btn>}
      {empty && <Card><EmptyState icon={<Inbox size={24} />} title={t('commandCenter.no_input')} testId="home-needs-you-empty" /></Card>}
      {followUps.length > 0 && (
        <Card className="py-1">
          <details data-testid="home-suggestions">
            <summary className="cursor-pointer text-sm text-muted py-1">{t('pages.homePage.suggestions_fold', { count: followUps.length, amount: fmtNumber(followUps.length) })}</summary>
            <ul className="list-none m-0 p-0">{followUps.map(item => <FollowUpRow key={item.id} item={item} title={title(item.slot)} />)}</ul>
          </details>
        </Card>
      )}
    </Section>
  )
}
