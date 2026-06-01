import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { NativeExtensionWidget, ThreadCustomMessageRecord } from '../../desktop/types'
import {
  appToneMutedClass,
  appTypeKickerClass,
  appTypeMetaClass,
  appTypeTinyClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type SmartBtwCardProps = {
  widget: NativeExtensionWidget
  onFold: () => void
  onPrevious: () => void
  onNext: () => void
  onSelect: (index: number) => void
  onClear: () => void
}

type SmartBtwSession = {
  index: number
  question: string
  status: SmartBtwTurn['status'] | 'unread'
}

type SmartBtwTurn = {
  question: string
  answer: string
  status: 'ready' | 'queued' | 'running' | 'thinking' | 'answered' | 'failed'
}

const smartBtwCardClass =
  'relative grid w-full content-start gap-2 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 pt-2.5 pb-3.5 shadow-none'
const headerPattern = /^btw\s+(folded|open)\s+(\d+)\/(\d+)\s+(\w+)\s+(.+)$/u
const sessionPattern = /^session\s+(\d+)\s+(\w+)\s+(.+)$/u
const turnPattern = /^turn\s+(\w+)\s+(.+)$/u
const answerPattern = /^answer\s+(.+)$/u
const smartBtwCustomType = 'BTW SESSION'

type RestoredBtwTurn = {
  question: string
  answer: string
  status: SmartBtwTurn['status']
  turn: number
}

type RestoredBtwGeneration = {
  slot: number
  generation: string
  cleared: boolean
  turns: RestoredBtwTurn[]
}

type BtwMessageDetails = {
  kind?: unknown
  generation?: unknown
  slot?: unknown
  question?: unknown
  answer?: unknown
  error?: unknown
  turn?: unknown
}

function encodeWidgetText(value: string) {
  return JSON.stringify(value)
}

function getBtwDetails(message: ThreadCustomMessageRecord) {
  if (!message.customType.startsWith(smartBtwCustomType)) return null
  const details = message.details
  if (typeof details !== 'object' || details === null) return null
  const candidate = details as BtwMessageDetails
  if (typeof candidate.generation !== 'string') return null
  if (!(typeof candidate.slot === 'number' && Number.isInteger(candidate.slot))) return null
  return candidate
}

function getRestoredGeneration(
  generations: Map<string, RestoredBtwGeneration>,
  details: BtwMessageDetails,
) {
  const slot = details.slot as number
  const generation = details.generation as string
  const key = `${slot}:${generation}`
  const record = generations.get(key) ?? { slot, generation, cleared: false, turns: [] }
  generations.set(key, record)
  return record
}

function addRestoredMessage(
  generations: Map<string, RestoredBtwGeneration>,
  message: ThreadCustomMessageRecord,
) {
  const details = getBtwDetails(message)
  if (!details) return
  const record = getRestoredGeneration(generations, details)
  if (details.kind === 'cleared') record.cleared = true
  if (details.kind !== 'result') return
  record.turns.push({
    question: String(details.question ?? ''),
    answer: String(details.answer ?? details.error ?? message.content ?? ''),
    status: typeof details.error === 'string' ? 'failed' : 'answered',
    turn: typeof details.turn === 'number' ? details.turn : record.turns.length + 1,
  })
}

function getOpenBtwGenerations(messages: ThreadCustomMessageRecord[]) {
  const generations = new Map<string, RestoredBtwGeneration>()
  for (const message of messages) addRestoredMessage(generations, message)
  const bySlot = new Map<number, RestoredBtwGeneration>()
  for (const record of generations.values()) {
    if (!(record.cleared || record.turns.length === 0)) bySlot.set(record.slot, record)
  }
  return [...bySlot.values()].sort((left, right) => left.slot - right.slot)
}

export function createSmartBtwWidgetFromMessages(
  messages: ThreadCustomMessageRecord[] | undefined,
): NativeExtensionWidget | undefined {
  const sessions = getOpenBtwGenerations(messages ?? [])
  if (sessions.length === 0) return undefined
  const active = sessions[0]
  if (!active) return undefined
  const lines = [`btw open ${active.slot}/${sessions.length} answered restored`]
  for (const session of sessions) {
    const firstQuestion = session.turns[0]?.question ?? 'btw session'
    lines.push(`session ${session.slot} answered ${encodeWidgetText(firstQuestion)}`)
  }
  for (const turn of active.turns.sort((left, right) => left.turn - right.turn).slice(-3)) {
    lines.push(`turn ${turn.status} ${encodeWidgetText(turn.question)}`)
    lines.push(`answer ${encodeWidgetText(turn.answer)}`)
  }
  lines.push('keys ctrl+alt: +Z compose · +C inject & clear · +X clear · ↑/↓ fold · ←/→ switch')
  return { key: 'smart-btw', lines, placement: 'aboveEditor' }
}

function normalizeStatus(value: string | undefined): SmartBtwTurn['status'] {
  if (value === 'failed') return 'failed'
  if (value === 'queued') return 'queued'
  if (value === 'running') return 'running'
  if (value === 'thinking') return 'thinking'
  if (value === 'answered') return 'answered'
  return 'ready'
}

function parseWidgetText(value: string | undefined, fallback: string) {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === 'string' ? parsed : fallback
  } catch {
    return value
  }
}

function parseSmartBtwWidget(widget: NativeExtensionWidget) {
  const header = widget.lines[0]?.match(headerPattern)
  const folded = header?.[1] === 'folded'
  const activeIndex = Number(header?.[2] ?? '1')
  const sessions: SmartBtwSession[] = []
  const turns: SmartBtwTurn[] = []

  for (const line of widget.lines.slice(1)) {
    const sessionMatch = line.match(sessionPattern)
    if (sessionMatch) {
      sessions.push({
        index: Number(sessionMatch[1]),
        status: sessionMatch[2] === 'unread' ? 'unread' : normalizeStatus(sessionMatch[2]),
        question: parseWidgetText(sessionMatch[3], 'btw session'),
      })
      continue
    }
    const turnMatch = line.match(turnPattern)
    if (turnMatch) {
      turns.push({
        status: normalizeStatus(turnMatch[1]),
        question: parseWidgetText(turnMatch[2], 'btw question'),
        answer: '',
      })
      continue
    }
    const answerMatch = line.match(answerPattern)
    const lastTurn = turns.at(-1)
    if (answerMatch && lastTurn) lastTurn.answer = parseWidgetText(answerMatch[1], '')
  }

  return { activeIndex, folded, sessions, turns }
}

function KeybindHint() {
  return (
    <div
      className={cn('min-w-0 truncate whitespace-nowrap px-2', appTypeTinyClass, appToneMutedClass)}
    >
      Ctrl+Alt: +Z compose · +C inject & clear · +X clear · ↑/↓ fold · ←/→ switch
    </div>
  )
}

function SessionNumberButton({
  active,
  index,
  status,
  onSelect,
}: {
  active: boolean
  index: number
  status: SmartBtwSession['status'] | undefined
  onSelect: (index: number) => void
}) {
  const running = status === 'running'
  const unread = status === 'unread'
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-5 w-5 translate-y-[-1px] items-center justify-center rounded-full p-0 transition-colors',
      )}
      onClick={() => onSelect(index)}
      aria-label={`Open btw session ${index}`}
    >
      <span
        className={cn(
          'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border px-0 pt-px transition-colors',
          appTypeKickerClass,
          running &&
            'animate-pulse border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] text-[color:var(--accent)]',
          unread &&
            'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] text-[color:var(--accent)]',
          active &&
            !(unread || running) &&
            'border-transparent bg-[color:var(--surface-hover)] text-[color:var(--text)]',
          !(active || unread || running) && `border-transparent ${appToneMutedClass}`,
          'hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
      >
        {index}
      </span>
    </button>
  )
}

function SessionNumberRow({
  activeIndex,
  sessions,
  onSelect,
}: {
  activeIndex: number
  sessions: SmartBtwSession[]
  onSelect: (index: number) => void
}) {
  return (
    <div className="flex min-w-max shrink-0 items-center gap-1 overflow-visible">
      <span className={cn('mr-1 shrink-0', appTypeTinyClass, appToneMutedClass)}>/BTW</span>
      {sessions.map((session) => (
        <SessionNumberButton
          key={session.index}
          active={session.index === activeIndex}
          index={session.index}
          status={session.status}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function CycleButtons({ onPrevious, onNext }: Pick<SmartBtwCardProps, 'onPrevious' | 'onNext'>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        onClick={onPrevious}
        aria-label="Previous btw session"
      >
        <ChevronLeft size={13} />
      </button>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        onClick={onNext}
        aria-label="Next btw session"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

function BtwTurnRows({ turns }: { turns: SmartBtwTurn[] }) {
  if (turns.length === 0) {
    return (
      <div className={cn('rounded-md px-2 py-1', appTypeTinyClass, appToneMutedClass)}>
        No questions yet.
      </div>
    )
  }

  return (
    <div className="grid gap-1 px-2">
      {turns.map((turn) => (
        <div key={`${turn.question}:${turn.status}`} className="grid gap-0.5 rounded-md py-1">
          <div className={cn('grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2', appTypeTinyClass)}>
            <span className={appToneMutedClass}>Q:</span>
            <span className="min-w-0 text-[color:var(--text)]">{turn.question}</span>
          </div>
          <div className={cn('grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2', appTypeTinyClass)}>
            <span className={appToneMutedClass}>A:</span>
            <span className="min-w-0 text-[color:var(--muted)]">
              {turn.answer ||
                (turn.status === 'failed'
                  ? 'Failed'
                  : turn.status === 'queued'
                    ? 'Queued…'
                    : 'Thinking…')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SmartBtwCard({
  widget,
  onFold,
  onPrevious,
  onNext,
  onSelect,
  onClear,
}: SmartBtwCardProps) {
  const { activeIndex, folded, sessions, turns } = parseSmartBtwWidget(widget)

  if (folded) {
    return (
      <div className="grid w-full overflow-visible px-4">
        <div className="grid w-full gap-2 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2 shadow-none">
          <SessionNumberRow activeIndex={activeIndex} sessions={sessions} onSelect={onSelect} />
          <KeybindHint />
        </div>
      </div>
    )
  }

  return (
    <div className="grid w-full overflow-visible px-4">
      <div className={smartBtwCardClass}>
        <div className="flex items-center gap-3 overflow-visible px-2">
          <SessionNumberRow activeIndex={activeIndex} sessions={sessions} onSelect={onSelect} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <CycleButtons onPrevious={onPrevious} onNext={onNext} />
            <button
              type="button"
              className={cn(
                'inline-flex h-6 items-center justify-center rounded-md px-2 text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
                appTypeMetaClass,
              )}
              onClick={onClear}
              aria-label="Clear btw session"
            >
              <X size={12} />
            </button>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={onFold}
              aria-label="Fold btw panel"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        </div>

        <BtwTurnRows turns={turns} />
        <KeybindHint />
      </div>
    </div>
  )
}
