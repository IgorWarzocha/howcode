import { BtwChild } from './child.mjs'
import { NUMBERED_SESSION_PATTERN } from './constants.mjs'
import { doneTurns } from './output.mjs'

export function createInitialState() {
  return { sessions: [], activeIndex: 0, folded: false, ctx: undefined, restored: false }
}

export function listSessions(state) {
  return state.sessions.filter(Boolean)
}

export function activeSession(state) {
  return state.sessions[state.activeIndex]
}

export function sessionStatus(session) {
  if (session.running || session.turns.some((turn) => turn.status === 'queued')) return 'running'
  if (session.unread) return 'unread'
  if (session.turns.some((turn) => turn.error)) return 'failed'
  if (doneTurns(session.turns).length > 0) return 'answered'
  return 'ready'
}

function makeSession(index) {
  return {
    index,
    generationId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    nextTurnIndex: 1,
    child: undefined,
    turns: [],
    running: false,
    unread: false,
    generation: 0,
    queue: Promise.resolve(),
  }
}

function lowestFreeIndex(state) {
  const index = state.sessions.findIndex((session) => !session)
  return index === -1 ? state.sessions.length : index
}

export function switchToSession(state, index) {
  const session = state.sessions[index]
  if (!session) return false
  state.activeIndex = index
  state.folded = false
  session.unread = false
  return true
}

export function switchRelativeSession(state, direction) {
  const sessions = listSessions(state)
  if (sessions.length === 0) return false
  const currentPosition = Math.max(
    0,
    sessions.findIndex((session) => session.index === state.activeIndex),
  )
  const next = sessions[(currentPosition + direction + sessions.length) % sessions.length]
  return next ? switchToSession(state, next.index) : false
}

export function createSession(state, index = lowestFreeIndex(state)) {
  while (state.sessions.length <= index) state.sessions.push(undefined)
  const session = makeSession(index)
  state.sessions[index] = session
  state.activeIndex = index
  state.folded = false
  return session
}

export function restoreSession(state, { generationId, index, turns }) {
  while (state.sessions.length <= index) state.sessions.push(undefined)
  const session = makeSession(index)
  session.generationId = generationId
  session.turns = turns
  session.nextTurnIndex = Math.max(0, ...turns.map((turn) => turn.turnIndex ?? 0)) + 1
  state.sessions[index] = session
  state.activeIndex = state.sessions[state.activeIndex] ? state.activeIndex : index
  return session
}

export function ensureSession(state, index) {
  const session = state.sessions[index] ?? createSession(state, index)
  switchToSession(state, index)
  return session
}

function selectNearestSession(state, clearedIndex) {
  const sessions = listSessions(state)
  if (sessions.length === 0) {
    state.activeIndex = 0
    return
  }
  const next =
    sessions.find((session) => session.index > clearedIndex) ??
    sessions.findLast((session) => session.index < clearedIndex) ??
    sessions[0]
  state.activeIndex = next.index
}

export async function clearSession(state, session) {
  session.generation++
  session.turns = []
  session.running = false
  session.unread = false
  session.queue = Promise.resolve()
  state.sessions[session.index] = undefined
  selectNearestSession(state, session.index)
  const child = session.child
  session.child = undefined
  await child?.stop()
}

export function parseBtwArgs(args) {
  const trimmed = args.trim()
  if (!trimmed) return { sessionNumber: undefined, question: '' }
  const match = trimmed.match(NUMBERED_SESSION_PATTERN)
  if (!match) return { sessionNumber: undefined, question: trimmed }
  return { sessionNumber: Number(match[1]), question: match[2]?.trim() ?? '' }
}

function getBtwDetails(message) {
  const details = message.details
  if (typeof details !== 'object' || details === null) return undefined
  if (typeof details.generation !== 'string') return undefined
  if (!Number.isInteger(details.slot) || details.slot < 1) return undefined
  return details
}

function getGenerationRecord(generations, details) {
  const key = `${details.slot}:${details.generation}`
  const record = generations.get(key) ?? {
    cleared: false,
    generationId: details.generation,
    slot: details.slot,
    turns: [],
  }
  generations.set(key, record)
  return record
}

function restoredTurnFromDetails(details, fallbackTurnIndex) {
  return {
    question: String(details.question ?? ''),
    answer: typeof details.answer === 'string' ? details.answer : undefined,
    error: typeof details.error === 'string' ? details.error : undefined,
    startedAt: typeof details.startedAt === 'number' ? details.startedAt : Date.now(),
    finishedAt: typeof details.finishedAt === 'number' ? details.finishedAt : undefined,
    status: details.error ? 'failed' : 'answered',
    turnIndex: Number.isInteger(details.turn) ? details.turn : fallbackTurnIndex,
  }
}

function collectBtwGenerations(messages) {
  const generations = new Map()
  for (const message of messages) {
    const details = getBtwDetails(message)
    if (!details) continue
    const record = getGenerationRecord(generations, details)
    if (details.kind === 'cleared') record.cleared = true
    if (details.kind === 'result')
      record.turns.push(restoredTurnFromDetails(details, record.turns.length + 1))
  }
  return generations
}

function latestOpenGenerationsBySlot(generations) {
  const latestBySlot = new Map()
  for (const record of generations.values()) {
    if (record.cleared || record.turns.length === 0) continue
    latestBySlot.set(record.slot, record)
  }
  return latestBySlot
}

export function restoreStateFromMessages(state, messages) {
  if (state.restored) return
  state.restored = true
  const latestBySlot = latestOpenGenerationsBySlot(collectBtwGenerations(messages))
  for (const record of latestBySlot.values()) {
    record.turns.sort((a, b) => (a.turnIndex ?? 0) - (b.turnIndex ?? 0))
    restoreSession(state, {
      generationId: record.generationId,
      index: record.slot - 1,
      turns: record.turns,
    })
  }
}

function isCurrentGeneration(session, generation) {
  return session.generation === generation
}

function finishTurn({ ctx, pi, state, session, turn, generation, sendResultMessage, render }) {
  if (!isCurrentGeneration(session, generation)) return
  turn.finishedAt = Date.now()
  session.running = false
  if (turn.answer || turn.error) {
    turn.status = turn.error ? 'failed' : 'answered'
    session.unread = !(state.activeIndex === session.index && !state.folded)
    sendResultMessage(pi, session, turn)
  }
  render(ctx, state)
}

export async function runBtwTurn({
  ctx,
  pi,
  question,
  state,
  session,
  turn,
  generation,
  sendResultMessage,
  render,
}) {
  if (!isCurrentGeneration(session, generation)) return
  session.running = true
  turn.status = 'running'
  turn.turnIndex ??= session.nextTurnIndex++
  render(ctx, state)
  try {
    if (!session.child) {
      session.child = new BtwChild(ctx.cwd, () => render(ctx, state))
      await session.child.ready()
    }
    if (!isCurrentGeneration(session, generation)) return
    turn.answer =
      (await session.child.ask(question, (partial) => {
        turn.partial = partial
        render(ctx, state)
      })) || '(no answer)'
    turn.partial = undefined
  } catch (error) {
    if (!isCurrentGeneration(session, generation)) return
    turn.error = error instanceof Error ? error.message : String(error)
    ctx.ui.notify(`/btw failed: ${turn.error}`, 'error')
  } finally {
    finishTurn({ ctx, pi, state, session, turn, generation, sendResultMessage, render })
  }
}
