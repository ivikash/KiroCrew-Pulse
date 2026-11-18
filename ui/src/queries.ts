/**
 * The page's reads as React Query options, one per gateway route, so every
 * section that needs the same list shares one cache entry. The host gives the
 * bundle its own query client, so these keys collide with nothing.
 *
 * Refresh: the slot list, questions and approvals re-read when the host's
 * `slots` event says the list changed (`useFleetRefresh`), and every read polls
 * at a slow cadence as a floor, so a change the socket does not announce still
 * lands within a minute.
 */
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppEvents } from '@kirocrew/app-sdk'
import { useEffect, useState } from 'react'
import { reads } from './api'
import { TIMELINE_HOURS, timelineWindow, turnsRange } from './timeline'

/** The slow floor under the live refresh, in milliseconds. */
const POLL_MS = 60_000
/** The schedule, roster and usage change rarely; read them less often. */
const SLOW_POLL_MS = 5 * 60_000

export const slotsQuery = queryOptions({ queryKey: ['crew-pulse', 'slots'], queryFn: reads.slots, refetchInterval: POLL_MS, staleTime: 5_000 })
export const questionsQuery = queryOptions({ queryKey: ['crew-pulse', 'questions'], queryFn: reads.questions, refetchInterval: POLL_MS, staleTime: 5_000 })
export const approvalsQuery = queryOptions({ queryKey: ['crew-pulse', 'approvals'], queryFn: reads.approvals, refetchInterval: POLL_MS, staleTime: 5_000 })
export const subagentsQuery = queryOptions({ queryKey: ['crew-pulse', 'subagents'], queryFn: reads.subagents, refetchInterval: POLL_MS, staleTime: 5_000 })
export const workflowsQuery = queryOptions({ queryKey: ['crew-pulse', 'workflows'], queryFn: reads.workflows, refetchInterval: POLL_MS, staleTime: 5_000 })
export const cronsQuery = queryOptions({ queryKey: ['crew-pulse', 'crons'], queryFn: reads.crons, refetchInterval: SLOW_POLL_MS, staleTime: 30_000 })
export const membersQuery = queryOptions({ queryKey: ['crew-pulse', 'members'], queryFn: reads.members, refetchInterval: SLOW_POLL_MS, staleTime: 30_000 })
export const usageQuery = queryOptions({ queryKey: ['crew-pulse', 'usage'], queryFn: reads.usage, refetchInterval: SLOW_POLL_MS, staleTime: 30_000 })
export const statusQuery = queryOptions({ queryKey: ['crew-pulse', 'status'], queryFn: reads.status, refetchInterval: POLL_MS, staleTime: 5_000 })
export const configQuery = queryOptions({ queryKey: ['crew-pulse', 'config'], queryFn: reads.config, staleTime: Infinity })

/** The keys the `slots` event invalidates: what a turn, an answer or a decision
 *  changes. The schedule, roster and usage are not among them. */
export const LIVE_KEYS = [slotsQuery.queryKey, questionsQuery.queryKey, approvalsQuery.queryKey, subagentsQuery.queryKey, workflowsQuery.queryKey] as const

/** Re-read the live sources when the host says the slot list changed. */
export function useFleetRefresh(): void {
  const client = useQueryClient()
  useAppEvents('slots', () => { for (const key of LIVE_KEYS) void client.invalidateQueries({ queryKey: key }) })
}

const WIDEST_HOURS = TIMELINE_HOURS[TIMELINE_HOURS.length - 1]

/** A session's turns over the board's widest window. Always the 24-hour
 *  superset, so switching 6/12/24 costs no request; off for rows the board is
 *  not drawing. `nowMs` is read to the minute, so the key moves once a minute. */
export function useTurnHistory(slot: string, nowMs: number, enabled: boolean) {
  const range = turnsRange(timelineWindow(WIDEST_HOURS, nowMs))
  return useQuery({
    queryKey: ['crew-pulse', 'turns', slot, range],
    queryFn: () => reads.turns(slot, range),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  })
}

/** The window's end, read to the minute, so the board's clock ticks once a
 *  minute rather than once a render. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => minuteFloor(Date.now()))
  useEffect(() => {
    const id = setInterval(() => setNow(minuteFloor(Date.now())), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function minuteFloor(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000
}
