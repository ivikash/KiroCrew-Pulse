import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import PulseApp from '../src/index'
import { fireStubEvent, stubNavigate, stubPosts, stubRoutes } from './stubs/app-sdk'

const H = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = Date.now()
const DAY = new Date(NOW).toISOString().slice(0, 10)

/** A realistic evening: a running session with a worker, three blockers, a
 *  follow-up offer, a resting session, four crons and two bots. */
function seedRoutes() {
  stubRoutes.set('/api/chat/slots', [
    { key: 's-release', title: 'Release 2.4 conductor', running: true, last_turn_ts: iso(NOW - 47 * 60_000), last_message: 'Rebasing workers', subagents_running: true, todo: { current: 'Rebase workers', tasks: [] } },
    { key: 's-asana', title: 'Q3 roadmap status', needs_input: true, last_message: 'Where should it go?' },
    { key: 's-infra', title: 'Payments canary fix', pending_approval: true, pending_approval_info: { request_id: 'r1', origin: 'coordinator', request_instance: 'i1', tool: 'shell', tool_input: 'git push', tool_purpose: 'Push the fix' } },
    { key: 's-native', title: 'Docs sweep', pending_approval: true, pending_approval_info: { request_id: 'n1', origin: 'native', request_mid: 'm9', tool: 'fs_write' } },
    { key: 's-docs', title: 'Weekly report', has_options: true, options: ['Publish', '/deploy'], options_ts: 't1' },
    { key: 's-rest', title: 'Old chat' },
    { key: 'member-bot', title: 'Status Bot', mode: 'member', running: true },
  ])
  stubRoutes.set('/api/ask-question/pending', { pending: [
    { slot: 's-asana', ask_id: 'ask1', questions: [{ question: 'Where should the status update go?', options: [{ label: 'Tracker and Slack' }, { label: 'Tracker only' }] }] },
  ] })
  stubRoutes.set('/api/approvals', [{ id: 'r1', instance: 'i1', slot: 's-infra', tool: 'shell', tool_input: 'git push origin feat/x', tool_purpose: 'Push the fix' }])
  stubRoutes.set('/api/spawn', { agents: [
    { id: 'w1', task: 'Rebase worker A', done: false, parent: 's-release', started: (NOW - 30 * 60_000) / 1000, last_tool: 'git' },
    { id: 'w0', task: 'Rebase worker B', done: true, outcome: 'completed', parent: 's-release', started: (NOW - 10 * H) / 1000 },
  ] })
  stubRoutes.set('/api/workflows/runs', { runs: [{ run_id: 'wf1', name: 'Nightly train', session_key: 's-release', status: 'running', last_log: 'Stage 3 of 5' }] })
  stubRoutes.set('/api/crons', { jobs: [
    { id: 'c1', name: 'Sync rollover', enabled: true, last_status: 'ok', next_run_ts: (NOW + 1.5 * H) / 1000 },
    { id: 'c2', name: 'Digest', enabled: true, last_status: 'error', next_run_ts: (NOW + 9 * H) / 1000 },
    { id: 'c3', name: 'Paused one', enabled: false },
    { id: 'c4', name: 'Fired', enabled: true, last_status: 'ok', next_run_ts: null, is_running: true },
  ] })
  stubRoutes.set('/api/members', { members: [
    { name: 'Status Bot', slug: 'status-bot', slot_key: 'member-bot', running: true, last_active_ts: (NOW - 4 * 60_000) / 1000 },
    { name: 'Docs Writer', slug: 'docs-writer', slot_key: 'member-docs', running: false, last_active_ts: (NOW - 3 * H) / 1000 },
  ] })
  stubRoutes.set('/api/usage/kiro', {
    sessions: { today: { sessions: 9, messages: 184 } }, billing: { plan: 'Pro', credits_used: 52, credits_plan: 100 }, local_day: DAY,
    tokens: { daily_history: [{ date: DAY, input: 310_000, output: 42_000, cache_creation: 0, cache_read: 260_000, cost_usd: 8.38,
      models: { 'claude-sonnet-4.5': { input: 180_000, output: 24_000, cost_usd: 4.65 }, 'gemini-2.5-pro': { input: 70_000, output: 10_000, cost_usd: 2.27 }, 'mistral-large-2': { input: 40_000, output: 6_000, cost_usd: 1.27 }, 'deepseek-v3': { input: 20_000, output: 2_000, cost_usd: 0.19 } } }] },
  })
  stubRoutes.set('/api/status', { start_time: (NOW - 26 * H) / 1000, version: '0.13.0-dev' })
  stubRoutes.set('/api/config/kirocrew', { agent: { acp_backend: 'claude' } })
  stubRoutes.set('/api/usage/turns', { turns: [{ ts: iso(NOW - 3 * H), duration_ms: 20 * 60_000 }, { ts: iso(NOW - 1 * H), duration_ms: 5 * 60_000 }] })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } })
  return render(<QueryClientProvider client={client}><PulseApp /></QueryClientProvider>)
}

const tile = (id: string) => screen.getByTestId(id)
const tileValue = (id: string) => within(tile(id)).getByTestId('stat-card-value').textContent

beforeEach(seedRoutes)

describe('PulsePage', () => {
  it('fills the stat strip from the five live reads, the schedule and today\'s usage', async () => {
    renderPage()
    await waitFor(() => expect(tileValue('home-stat-active')).toBe('3'))
    expect(within(tile('home-stat-active')).getByTestId('stat-card-detail')).toHaveTextContent('1 session, 1 subagent, and 1 workflow')
    // Everything waiting on a person counts: 3 blockers plus 1 follow-up offer.
    expect(tileValue('home-stat-attention')).toBe('4')
    expect(within(tile('home-stat-attention')).getByTestId('stat-card-detail')).toHaveTextContent('1 question and 2 approvals · 1 suggestion')
    expect(tileValue('home-stat-schedule')).toBe('3')
    expect(within(tile('home-stat-schedule')).getByTestId('stat-card-detail')).toHaveTextContent('Next: Sync rollover')
    expect(within(tile('home-stat-schedule')).getByTestId('stat-card-detail')).toHaveTextContent('1 failing · 1 paused')
    await waitFor(() => expect(tileValue('home-stat-today')).toBe('$8.38'))
    expect(within(tile('home-stat-today')).getByTestId('stat-card-detail')).toHaveTextContent('Today: 9 sessions · 184 messages · 612K tokens · $8.38')
  })

  it('shows tokens, not dollars, on a credit-billed harness', async () => {
    stubRoutes.set('/api/config/kirocrew', { agent: { acp_backend: 'kas' } })
    renderPage()
    await waitFor(() => expect(tileValue('home-stat-today')).toBe('9'))
    expect(within(tile('home-stat-today')).getByTestId('stat-card-detail')).toHaveTextContent('Today: 9 sessions · 184 messages')
    expect(within(tile('home-stat-today')).getByTestId('stat-card-detail')).not.toHaveTextContent('$')
    const spend = await screen.findByTestId('home-spend')
    expect(within(spend).getByTestId('home-spend-count')).toHaveTextContent('tokens')
  })

  it('draws the board in reading order, nests workers, rests idle sessions and leaves Bots to their panel', async () => {
    renderPage()
    const active = await screen.findByTestId('home-fleet-active')
    const rows = within(active).getAllByTestId('home-fleet-row')
    expect(rows.map(r => r.getAttribute('data-state'))).toEqual(['needs_input', 'needs_input', 'needs_input', 'running', 'running', 'running', 'done'])
    expect(rows[3]).toHaveTextContent('Release 2.4 conductor')
    // A live worker draws a span to now; a finished one has no end time, so it draws none.
    expect(within(rows[4]).getByTestId('home-track-live')).toBeInTheDocument()
    expect(within(rows[6]).queryByTestId('home-track-span')).toBeNull()
    expect(within(rows[6]).queryByTestId('home-track-live')).toBeNull()
    // The board's clock is read to the minute, so the age is 46 or 47 minutes.
    expect(rows[3]).toHaveTextContent(/running 4[67]m/)
    expect(rows[4]).toHaveTextContent('Rebase worker A')
    expect(rows[5]).toHaveTextContent('Nightly train')
    expect(screen.queryByText('Status Bot', { selector: '[data-testid="home-fleet-row"] *' })).toBeNull()
    const resting = screen.getByTestId('home-fleet-resting')
    // The idle session whose reply offered next steps rests too: nothing is stuck.
    expect(resting).toHaveTextContent('2 at rest')
    expect(within(resting).getByText('Old chat')).toBeInTheDocument()
    expect(within(resting).getByText('Weekly report')).toBeInTheDocument()
    await waitFor(() => expect(within(rows[3]).getAllByTestId('home-track-span').length).toBe(2))
    expect(within(rows[3]).getByTestId('home-track-live')).toBeInTheDocument()
    expect(within(rows[0]).getByTestId('home-track-ask')).toBeInTheDocument()
  })

  it('answers a question card only on Send, through the ask route, then re-reads the inbox', async () => {
    const user = userEvent.setup()
    renderPage()
    const grid = await screen.findByTestId('home-needs-you-grid')
    const card = within(grid).getAllByTestId('home-attention-card').find(c => c.textContent?.includes('Q3 roadmap status'))!
    const send = within(card).getByTestId('home-send-answer')
    expect(send).toBeDisabled()
    await user.click(within(card).getByRole('button', { name: 'Tracker only' }))
    expect(stubPosts).toHaveLength(0)
    expect(send).toBeEnabled()
    await user.click(send)
    await waitFor(() => expect(stubPosts).toEqual([{ path: '/api/ask-question/ask1/answer', body: { answers: { 'Where should the status update go?': 'Tracker only' } } }]))
  })

  it('decides a coordinator approval on its own route and a native one on the slot route', async () => {
    const user = userEvent.setup()
    renderPage()
    const grid = await screen.findByTestId('home-needs-you-grid')
    const cards = within(grid).getAllByTestId('home-attention-card')
    const infra = cards.find(c => c.textContent?.includes('Payments canary fix'))!
    expect(infra).toHaveTextContent('shell wants to run')
    await user.click(within(infra).getByTestId('home-approve'))
    await waitFor(() => expect(stubPosts).toHaveLength(1))
    expect(stubPosts[0].path).toMatch(/^\/api\/approvals\/r1\/approve\?origin=coordinator&slot=s-infra&instance=i1$/)
    expect(stubPosts[0].body).toMatchObject({ response_id: expect.stringMatching(/^r_/) })
    const native = cards.find(c => c.textContent?.includes('Docs sweep'))!
    await user.click(within(native).getByTestId('home-reject'))
    await waitFor(() => expect(stubPosts).toHaveLength(2))
    expect(stubPosts[1]).toMatchObject({ path: '/api/chat/slots/s-native/approve', body: { action: 'rejected_once', origin: 'native', request_id: 'n1', request_mid: 'm9' } })
  })

  it('shows a follow-up offer as a card, withholds command-shaped labels and sends a pick as a message', async () => {
    const user = userEvent.setup()
    renderPage()
    const grid = await screen.findByTestId('home-needs-you-grid')
    const card = within(grid).getAllByTestId('home-attention-card').find(c => c.textContent?.includes('Weekly report'))!
    const offer = within(card).getByTestId('home-follow-up')
    expect(within(offer).getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(within(offer).queryByRole('button', { name: '/deploy' })).toBeNull()
    expect(within(offer).getByRole('link', { name: /Answer in the session/ })).toBeInTheDocument()
    const send = within(card).getByTestId('home-follow-up-send')
    expect(send).toBeDisabled()
    await user.click(within(offer).getByRole('button', { name: 'Publish' }))
    expect(stubPosts).toHaveLength(0)
    await user.click(send)
    await waitFor(() => expect(stubPosts).toEqual([{ path: '/api/chat', body: { message: 'Publish', slot: 's-docs' } }]))
  })

  it('shows six cards at first and three more per click, blockers before offers', async () => {
    const user = userEvent.setup()
    stubRoutes.set('/api/chat/slots', [
      { key: 'q1', title: 'Ask one', needs_input: true },
      ...Array.from({ length: 8 }, (_, i) => ({ key: `o${i}`, title: `Offer ${i}`, has_options: true, options: ['Go'], options_ts: `t${i}` })),
    ])
    stubRoutes.set('/api/ask-question/pending', [])
    stubRoutes.set('/api/approvals', [])
    renderPage()
    const grid = await screen.findByTestId('home-needs-you-grid')
    expect(within(grid).getAllByTestId('home-attention-card')).toHaveLength(6)
    expect(within(grid).getAllByTestId('home-attention-card')[0]).toHaveTextContent('Ask one')
    await waitFor(() => expect(tileValue('home-stat-attention')).toBe('9'))
    const more = screen.getByTestId('home-needs-you-more')
    expect(more).toHaveTextContent('Show 3 more')
    await user.click(more)
    expect(within(grid).getAllByTestId('home-attention-card')).toHaveLength(9)
    expect(screen.queryByTestId('home-needs-you-more')).toBeNull()
  })

  it('lists spend by model, the next jobs, the bots and the gateway health', async () => {
    renderPage()
    const spend = await screen.findByTestId('home-spend')
    await waitFor(() => expect(within(spend).getAllByTestId('home-spend-row')).toHaveLength(4))
    expect(within(spend).getAllByTestId('home-spend-row')[0]).toHaveTextContent('claude-sonnet-4.5')
    expect(within(spend).getAllByTestId('home-spend-row')[0]).toHaveTextContent('$4.65')
    expect(spend).toHaveTextContent('Pro plan: 52% used')
    const schedule = screen.getByTestId('home-schedule')
    expect(within(schedule).getAllByTestId('home-schedule-row').map(r => r.textContent)).toEqual([
      expect.stringContaining('Sync rollover'), expect.stringContaining('Digest'),
    ])
    expect(within(schedule).getAllByTestId('home-schedule-row')[1]).toHaveTextContent('Error')
    const bots = screen.getByTestId('home-bots')
    expect(within(bots).getByTestId('home-bots-count')).toHaveTextContent('1 of 2 working')
    expect(within(bots).getAllByTestId('home-bot-row')[0]).toHaveTextContent('Status Bot')
    expect(screen.getByTestId('gateway-health-line')).toHaveTextContent('All systems running')
    expect(screen.getByTestId('gateway-health-line')).toHaveTextContent('v0.13.0-dev')
  })

  it('navigates through the host router and re-reads the live lists on the slots event', async () => {
    const user = userEvent.setup()
    renderPage()
    const active = await screen.findByTestId('home-fleet-active')
    await user.click(within(active).getAllByRole('link', { name: /Open session/ })[0])
    expect(stubNavigate).toHaveBeenCalledWith('/chat?sid=s-asana')
    stubRoutes.set('/api/chat/slots', [{ key: 's-only', title: 'Only one', running: true }])
    stubRoutes.set('/api/ask-question/pending', [])
    stubRoutes.set('/api/approvals', [])
    fireStubEvent('slots')
    await waitFor(() => expect(tileValue('home-stat-active')).toBe('1'))
    expect(tileValue('home-stat-attention')).toBe('0')
  })

  it('says which source failed and keeps the rest of the page', async () => {
    stubRoutes.set('/api/chat/slots', new Error('boom'))
    stubRoutes.set('/api/crons', new Error('boom'))
    stubRoutes.set('/api/members', new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('alert').map(a => a.textContent)).toEqual(
      expect.arrayContaining(['The sessions could not be loaded.', 'The schedule could not be loaded.', 'The bots could not be loaded.']),
    ))
    expect(tileValue('home-stat-schedule')).toBe('—')
    await waitFor(() => expect(tileValue('home-stat-today')).toBe('$8.38'))
  })

  it('shows empty states when nothing runs, waits or is due', async () => {
    stubRoutes.set('/api/chat/slots', [])
    stubRoutes.set('/api/ask-question/pending', [])
    stubRoutes.set('/api/approvals', [])
    stubRoutes.set('/api/spawn', { agents: [] })
    stubRoutes.set('/api/workflows/runs', { runs: [] })
    stubRoutes.set('/api/crons', { jobs: [] })
    stubRoutes.set('/api/members', { members: [] })
    renderPage()
    expect(await screen.findByTestId('home-fleet-empty')).toBeInTheDocument()
    expect(screen.getByTestId('home-needs-you-empty')).toBeInTheDocument()
    expect(screen.getByTestId('home-schedule-empty')).toBeInTheDocument()
    expect(screen.getByTestId('home-bots-empty')).toBeInTheDocument()
  })
})
