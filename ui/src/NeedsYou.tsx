/**
 * The "Needs you" inbox: a card per session that waits on a person, each
 * answerable from here and routed to the same gateway endpoints the dashboard's
 * own cards use. Blockers come first (a question card, a tool approval, a
 * session marked needs-input), then sessions whose newest reply offered next
 * steps in an `[OPTIONS:]` line. Six cards show at first; "Show all" opens
 * the rest.
 *
 * Nothing here sends on a click alone: a pick stays a draft until "Send answer",
 * and an approval needs its own button. A label the dashboard would refuse to
 * send bare (one that reads as a command) is withheld with a link to answer in
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
import { RowLink, Section, sessionRoute } from './rows'
import type { ChatSlot, PendingQuestion, QuestionPrompt } from './types'

/** Cards shown at first: two rows of the widest grid. "Show all" opens the rest. */
const INITIAL_CARDS = 6

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

/** A session whose newest reply offered next steps: pick one, or type a reply
 *  of your own, and send it as the session's next message. A pick and typed
 *  text are one answer, so choosing one clears the other. A command-shaped label
 *  is withheld: sent bare it would run rather than say, so it is answered in the
 *  session itself. */
function FollowUpCard({ item, title }: { item: Extract<AttentionItem, { kind: 'follow_up' }>; title: string }) {
  const [pick, setPick] = useState('')
  const [typed, setTyped] = useState('')
  const refresh = useLiveInvalidate()
  const mutation = useMutation({ mutationFn: (message: string) => writes.send(item.slot, message), onSuccess: refresh })
  const sendable = item.followUp.labels.filter(l => !isCommandShaped(l))
  const withheld = item.followUp.labels.length - sendable.length
  const answer = pick || typed.trim()
  return (
    <CardShell title={title} slot={item.slot}>
      <div className="rounded-lg bg-accent-subtle p-3 space-y-2" data-testid="home-follow-up">
        <div className="text-sm font-medium">{t('commandCenter.options_question')}</div>
        <div className="grid gap-2">
          {sendable.map(label => (
            <button key={label} type="button" aria-pressed={pick === label} onClick={() => { setPick(p => p === label ? '' : label); setTyped('') }}
              className={`text-left text-sm rounded-md border px-3 py-2 ${pick === label ? 'border-accent bg-accent/15' : 'border-border bg-card'}`}>{label}</button>
          ))}
          <input type="text" value={typed} onChange={e => { setTyped(e.target.value); setPick('') }} placeholder={t('components.questionCard.or_type_a_custom_answer')}
            className="text-sm rounded-md border border-border bg-card px-3 py-2 min-w-0" aria-label={t('components.questionCard.or_type_a_custom_answer')} data-testid="home-follow-up-text" />
        </div>
        {withheld > 0 && <RowLink to={sessionRoute(item.slot)}>{t('pulse.answer_in_session')}</RowLink>}
      </div>
      <ErrorNotice message={mutation.isError ? errorLine(mutation.error, 'pulse.answer_failed') : undefined} />
      <div className="flex justify-end">
        <Btn primary disabled={!answer || mutation.isPending} onClick={() => mutation.mutate(answer)} data-testid="home-follow-up-send">
          <MessageSquare size={14} className="lucide-inline" /> {t('commandCenter.send_answer')}
        </Btn>
      </div>
    </CardShell>
  )
}

export default function NeedsYou({ attention, sessions, slots, ready }: {
  attention: AttentionSplit
  sessions: ReadonlyMap<string, RunNode>
  slots: ReadonlyMap<string, ChatSlot>
  ready: boolean
}) {
  const [visible, setVisible] = useState(INITIAL_CARDS)
  const title = (slot: string) => { const n = sessions.get(slot); return n ? (n.title || slot) : slot }
  const items: AttentionItem[] = [...attention.blockers, ...attention.followUps]
  const shown = items.slice(0, visible)
  const hidden = items.length - shown.length
  return (
    <Section label={t('commandCenter.attention_filter')} count={fmtNumber(items.length)} testId="home-needs-you">
      {shown.length > 0 && (
        <div className="grid ch-cards gap-3 items-start" data-testid="home-needs-you-grid">
          {shown.map(item => {
            if (item.kind === 'question') return <QuestionCard key={item.id} item={item} title={title(item.slot)} />
            if (item.kind === 'approval') return <ApprovalCard key={item.id} item={item} title={title(item.slot)} slot={slots.get(item.slot)} />
            if (item.kind === 'follow_up') return <FollowUpCard key={item.id} item={item} title={title(item.slot)} />
            return <OpenSessionCard key={item.id} item={item} title={title(item.slot)} detail={sessions.get(item.slot)?.detail} />
          })}
        </div>
      )}
      {hidden > 0 && <Btn onClick={() => setVisible(items.length)} data-testid="home-needs-you-more">{t('pages.homePage.show_all', { count: hidden, amount: fmtNumber(hidden) })}</Btn>}
      {ready && !items.length && <Card><EmptyState icon={<Inbox size={24} />} title={t('commandCenter.no_input')} testId="home-needs-you-empty" /></Card>}
    </Section>
  )
}
