/**
 * The gateway payloads Pulse reads, narrowed to the fields it uses. Each
 * shape mirrors the dashboard's own type for the same route; a field the page
 * never reads is left out so a gateway that drops it changes nothing here.
 */

/** One row of `GET /api/chat/slots`, and of the `slots` push. */
export interface ChatSlot {
  key: string
  title?: string
  messages?: number
  running?: boolean
  interrupted?: boolean
  queue_depth?: number
  queue_held_depth?: number
  needs_input?: boolean
  pending_approval?: boolean
  pending_approval_info?: SlotApprovalInfo | null
  has_options?: boolean
  options?: string[]
  options_ts?: string
  last_message?: string
  last_turn_ts?: string
  subagents_running?: boolean
  todo?: { current?: string; tasks: { completed: boolean }[] }
  /** A Bot's pinned thread; the roster lists it, so the board does not. */
  mode?: string
}

/** The tool a session waits on, as the slot row carries it. */
export interface SlotApprovalInfo {
  request_id: string
  origin?: 'native' | 'coordinator' | string
  request_mid?: string
  request_instance?: string
  tool?: string
  tool_input?: unknown
  tool_purpose?: string
}

/** One pending question from `GET /api/ask-question/pending`. */
export interface PendingQuestion {
  slot: string
  ask_id?: string
  card_id?: string
  native?: boolean
  questions: QuestionPrompt[]
}

export interface QuestionPrompt {
  question: string
  header?: string
  options: { label: string; description?: string }[]
  multiSelect?: boolean
}

/** One row of `GET /api/approvals`: a background request the coordinator holds. */
export interface PendingApproval {
  id: string
  instance?: string
  slot?: string
  tool?: string
  tool_input?: unknown
  tool_purpose?: string
}

/** One row of `GET /api/workflows/runs`. */
export interface WorkflowRun {
  run_id: string
  name?: string
  session_key?: string
  status?: string
  error?: string | null
  last_log?: string
  ended_at?: string | null
}

/** One row of `GET /api/spawn`. `parent` is the session that dispatched it. */
export interface SubagentInfo {
  id: string
  task: string
  done: boolean
  error?: string
  parent?: string
  outcome?: 'completed' | 'failed' | 'stopped'
  /** Epoch seconds. The gateway records no end time for a finished run. */
  started?: number
  /** Present only while the run is live. */
  last_tool?: string
  stopped?: boolean
  awaiting_approval?: boolean
}

/** One row of `GET /api/crons`. */
export interface CronJob {
  id: string
  name: string
  enabled: boolean
  last_status?: string
  is_running?: boolean
  /** Epoch seconds, the gateway's own forecast; absent when none. */
  next_run_ts?: number | null
}

/** One row of the Bots roster (`GET /api/members`). */
export interface MemberRow {
  name: string
  slug: string
  slot_key: string
  running: boolean
  /** Epoch seconds. */
  last_active_ts?: number
  display_name?: string
}

/** `GET /api/usage/kiro`, the fields the Today tile and the spend panel read. */
export interface UsageReport {
  sessions?: {
    today?: { sessions?: number; messages?: number }
    error?: string
  }
  billing?: { plan?: string; credits_used?: number; credits_plan?: number }
  tokens?: { daily_history?: DailyTokens[] }
  /** The gateway's own local day, `YYYY-MM-DD`. */
  local_day?: string
}

export interface DailyTokens {
  date: string
  input?: number
  output?: number
  cache_creation?: number
  cache_read?: number
  cost_usd?: number
  models?: Record<string, ModelTokens>
}

export interface ModelTokens {
  input?: number
  output?: number
  cache_create?: number
  cache_read?: number
  cost_usd?: number
}

/** `GET /api/status`, the two fields the footer reads. */
export interface GatewayStatus {
  /** Epoch seconds. */
  start_time?: number
  version?: string
}

/** `GET /api/config/kirocrew`, the one field that decides dollars or tokens. */
export interface KiroCrewConfig {
  agent?: { acp_backend?: string }
}

/** One per-turn usage row from `GET /api/usage/turns`. `ts` is when the turn
 *  ended: the gateway writes the row once the usage is known. */
export interface TurnRow {
  ts: string
  duration_ms?: number
}
