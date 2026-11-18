import { describe, expect, it } from 'vitest'
import { pointOn, spanOn, tickTimes, timelineWindow, turnSpans, turnsRange } from '../src/timeline'

const H = 3_600_000
const NOW = 1_000 * H
const win = timelineWindow(12, NOW)

describe('timelineWindow and turnsRange', () => {
  it('ends now and starts the chosen hours earlier', () => {
    expect(win).toEqual({ startMs: NOW - 12 * H, endMs: NOW })
    expect(turnsRange(win)).toBe(`since=${(NOW - 12 * H) / 1000}&until=${NOW / 1000}`)
  })
})

describe('spanOn', () => {
  it('places a span as percentages and clamps it to the window', () => {
    expect(spanOn(win, NOW - 6 * H, NOW - 3 * H)).toEqual({ leftPct: 50, widthPct: 25 })
    expect(spanOn(win, NOW - 20 * H, NOW - 6 * H)).toEqual({ leftPct: 0, widthPct: 50 })
    expect(spanOn(win, NOW - 1 * H, NOW + 5 * H)!.widthPct).toBeCloseTo(100 - 100 * 11 / 12)
  })
  it('keeps a brief turn visible as a sliver and drops one outside the window', () => {
    expect(spanOn(win, NOW - 6 * H, NOW - 6 * H)).toEqual({ leftPct: 50, widthPct: 0.4 })
    expect(spanOn(win, NOW - 1_000, NOW)!.leftPct).toBeLessThanOrEqual(99.6)
    expect(spanOn(win, NOW - 30 * H, NOW - 20 * H)).toBeNull()
    expect(spanOn({ startMs: 5, endMs: 5 }, 1, 2)).toBeNull()
  })
  it('tolerates a span whose end precedes its start', () => {
    expect(spanOn(win, NOW - 3 * H, NOW - 6 * H)).toEqual({ leftPct: 50, widthPct: 25 })
  })
})

describe('pointOn and tickTimes', () => {
  it('places an instant, or null outside the window', () => {
    expect(pointOn(win, NOW - 6 * H)).toBe(50)
    expect(pointOn(win, NOW)).toBe(100)
    expect(pointOn(win, NOW + 1)).toBeNull()
    expect(pointOn(win, NOW - 13 * H)).toBeNull()
  })
  it('spaces ticks evenly from the start, excluding the end', () => {
    expect(tickTimes(win, 6)).toEqual([0, 2, 4, 6, 8, 10].map(h => NOW - (12 - h) * H))
  })
})

describe('turnSpans', () => {
  it('maps rows to spans oldest first and drops an undatable row', () => {
    const rows = [
      { ts: new Date(NOW - 6 * H).toISOString(), duration_ms: 3 * H },
      { ts: 'not a date', duration_ms: 1 },
      { ts: new Date(NOW - 1 * H).toISOString() },
      { ts: new Date(NOW - 2 * H).toISOString(), duration_ms: -5 },
    ]
    const spans = turnSpans(rows, win)
    expect(spans).toHaveLength(3)
    expect(spans[0]).toEqual({ leftPct: 50, widthPct: 25 })
    expect(spans[1].widthPct).toBe(0.4)
    expect(spans[2].widthPct).toBe(0.4)
  })
})
