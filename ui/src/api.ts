/**
 * Every gateway call the page makes, through the host's scoped client. The
 * client is a hook (`useAppApi`), but query functions and mutations run outside
 * render, so the root component binds it once and every call reads it back.
 *
 * Each path here is declared in `app.json`'s `permissions.api`; the SDK refuses
 * one that is not, so the manifest and this file are the two halves of one list
 * (`tests/manifest.test.ts` holds them together).
 */
import type { AppApi } from '@kirocrew/app-sdk'
import type {
  ChatSlot, CronJob, GatewayStatus, KiroCrewConfig, MemberRow, PendingApproval, PendingQuestion,
  SlotApprovalInfo, SubagentInfo, TurnRow, UsageReport, WorkflowRun,
} from './types'

let bound: AppApi | null = null

/** Called by the page root with `useAppApi()`. */
export function bindAppApi(api: AppApi): void {
  bound = api
}

function api(): AppApi {
  if (!bound) throw new Error('crew-pulse: the host API is not bound yet')
  return bound
}

/** One id per click on a decision, never derived from content, so the server
 *  replays a retry of the same click and refuses a different later one. */
function mintResponseId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return 'r_' + c.randomUUID()
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

const list = <T,>(value: unknown, key?: string): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (key && value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key])) {
    return (value as Record<string, T[]>)[key]
  }
  return []
}

export const reads = {
  slots: async (): Promise<ChatSlot[]> => list<ChatSlot>(await api().get('/api/chat/slots'), 'slots'),
  questions: async (): Promise<PendingQuestion[]> => list<PendingQuestion>(await api().get('/api/ask-question/pending'), 'pending'),
  approvals: async (): Promise<PendingApproval[]> => list<PendingApproval>(await api().get('/api/approvals')),
  subagents: async (): Promise<SubagentInfo[]> => list<SubagentInfo>(await api().get('/api/spawn'), 'agents'),
  workflows: async (): Promise<WorkflowRun[]> => list<WorkflowRun>(await api().get('/api/workflows/runs'), 'runs'),
  crons: async (): Promise<CronJob[]> => list<CronJob>(await api().get('/api/crons'), 'jobs'),
  members: async (): Promise<MemberRow[]> => list<MemberRow>(await api().get('/api/members'), 'members'),
  usage: (): Promise<UsageReport> => api().get<UsageReport>('/api/usage/kiro'),
  status: (): Promise<GatewayStatus> => api().get<GatewayStatus>('/api/status'),
  config: (): Promise<KiroCrewConfig> => api().get<KiroCrewConfig>('/api/config/kirocrew'),
  turns: async (slot: string, range: string): Promise<TurnRow[]> =>
    list<TurnRow>(await api().get(`/api/usage/turns?slot=${encodeURIComponent(slot)}&${range}`), 'turns'),
}

export type ApprovalAction = 'approve' | 'reject_once'

/** The one request a decision names. A coordinator request is decided on its
 *  own route bound to its slot and instance; a session's own (native) request on
 *  the slot's approve route bound to the row's message id. Either is refused
 *  once another request holds the id, so a stale card cannot decide a new ask. */
export type ApprovalTarget =
  | { origin: 'coordinator'; id: string; slot: string; instance: string }
  | { origin: 'native'; id: string; slot: string; mid: string }

export function approvalTarget(slot: string, approval: PendingApproval | undefined, info: SlotApprovalInfo | null | undefined): ApprovalTarget | null {
  if (approval) return { origin: 'coordinator', id: approval.id, slot, instance: approval.instance ?? '' }
  if (info?.origin === 'native' && info.request_mid) return { origin: 'native', id: info.request_id, slot, mid: info.request_mid }
  if (info?.origin === 'coordinator') return { origin: 'coordinator', id: info.request_id, slot, instance: info.request_instance ?? '' }
  return null
}

export const writes = {
  decide: (target: ApprovalTarget, action: ApprovalAction): Promise<unknown> => {
    const responseId = mintResponseId()
    if (target.origin === 'coordinator') {
      const query = new URLSearchParams({ origin: 'coordinator', slot: target.slot, instance: target.instance })
      return api().post(`/api/approvals/${encodeURIComponent(target.id)}/${action}?${query}`, { response_id: responseId })
    }
    return api().post(`/api/chat/slots/${encodeURIComponent(target.slot)}/approve`, {
      action: action === 'approve' ? 'approved' : 'rejected_once',
      origin: 'native', request_id: target.id, request_mid: target.mid, response_id: responseId,
    })
  },
  /** Answer a question card: the MCP `ask_question` wait receives `answers`. */
  answer: (askId: string, answers: Record<string, string>): Promise<unknown> =>
    api().post(`/api/ask-question/${encodeURIComponent(askId)}/answer`, { answers }),
  /** Send a follow-up pick as an ordinary message to its session. */
  send: (slot: string, message: string): Promise<unknown> =>
    api().post('/api/chat', { message, slot }),
}
