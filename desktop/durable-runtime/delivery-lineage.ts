import type { Context } from '@earendil-works/chord'
import {
  type Cursor,
  defineDoc,
  type Harness,
  LiveDoc,
  type TaskId,
  type Tx,
} from '@earendil-works/pi-durable'
import type {
  AcceptedWork,
  InputAdmission,
  InputOrigin,
} from '@howaboua/howcode-sdk/input-delivery'
import { decodeConversationId } from './identity.ts'
import {
  agentInputOrigin,
  componentActionOrigin,
  mcpInputOrigin,
  scheduledInputOrigin,
} from './input-origin.ts'

type NativeTaskRecord = NonNullable<Awaited<ReturnType<Tx['task']>>>

function assertContinuationNotCancelled(task: NativeTaskRecord, mode: 'continuation' | 'passive') {
  if (mode === 'passive' || task.abortReason === 'restart') return
  if (
    task.abortRequested ||
    (task.state.status === 'terminal' && task.state.outcome.status === 'aborted')
  )
    throw new Error(
      'The accepted native work was cancelled; only passive settlement remains available.',
    )
}

/** Admission metadata lives on the native task; it is not an occurrence or execution ledger. */
export const AcceptedInputTaskDoc = defineDoc({
  kind: 'howcode.accepted-input-task',
  version: 1,
  scope: 'task',
  initial: () => ({
    accepted: false,
    source: '',
    scopeId: '',
    occurrenceId: '',
    conversationId: '',
    acceptedAt: 0,
    nativeRun: 0,
    originKind: '',
    actorConversationId: '',
    actorTaskId: '',
  }),
})

export async function stampAcceptedInputTask(
  tx: Tx,
  request: InputAdmission & { taskId: TaskId },
  at: number,
  origin: InputOrigin,
) {
  const marker = await tx.doc(AcceptedInputTaskDoc, request.taskId)
  Object.assign(marker, {
    accepted: true,
    source: request.source,
    scopeId: request.scopeId,
    occurrenceId: request.occurrenceId,
    conversationId: request.conversationId,
    acceptedAt: at,
    originKind: origin.kind,
    actorConversationId: origin.kind === 'agent' ? origin.conversationId : '',
    actorTaskId: origin.kind === 'agent' ? (origin.taskId ?? '') : '',
  })
}

export function decodeTaskId(value: string): TaskId {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1 || String(id) !== value)
    throw new Error(`Invalid Durable task identity: ${value}`)
  return id as TaskId
}

/** Capture while the native caller is executing; a later completed caller retains this proof. */
export async function captureNativeAcceptedWork(
  tx: Tx,
  caller: { conversationId: string; taskId: string },
  target = caller.conversationId,
): Promise<AcceptedWork> {
  const conversationId = decodeConversationId(caller.conversationId)
  const taskId = decodeTaskId(caller.taskId)
  const live = await tx.doc(LiveDoc, conversationId)
  if (!live.run || live.run.inputs.length === 0)
    throw new Error('The caller has no accepted native input to continue.')
  const runId = live.run.taskId
  const seen = new Set<TaskId>()
  let current: TaskId | undefined = taskId
  let validated = false
  while (current !== undefined && !seen.has(current)) {
    seen.add(current)
    const task = await tx.task(current)
    if (
      !task ||
      task.conversationId !== conversationId ||
      task.background ||
      task.abortRequested ||
      task.state.status === 'terminal'
    )
      break
    if (task.id === runId) {
      validated = true
      break
    }
    current = task.owner
  }
  if (!validated) throw new Error('The caller is not executing within the accepted native run.')
  const marker = await tx.doc(AcceptedInputTaskDoc, taskId)
  if (marker.accepted && marker.conversationId !== target)
    throw new Error('Accepted-work conversation identity mismatch.')
  Object.assign(marker, {
    accepted: true,
    source: 'native',
    conversationId: target,
    acceptedAt: marker.acceptedAt || Date.now(),
    nativeRun: runId,
    originKind: 'agent',
    actorConversationId: caller.conversationId,
    actorTaskId: caller.taskId,
  })
  return { taskId: caller.taskId, conversationId: target }
}

/** Native worker settlement may address its owner chain, never an unrelated family or fork. */
export async function captureNativeSettlement(
  tx: Tx,
  caller: { conversationId: string; taskId: string },
  target: string,
): Promise<AcceptedWork | undefined> {
  const seen = new Set<string>()
  let current: string | undefined = caller.conversationId
  while (current !== undefined && !seen.has(current)) {
    if (current === target) return captureNativeAcceptedWork(tx, caller, target)
    seen.add(current)
    const conversation = await tx.conversation(decodeConversationId(current))
    if (!conversation) throw new Error('The native caller conversation is missing.')
    current = conversation.owner ? String(conversation.owner.conversationId) : undefined
  }
  return undefined
}

export async function validateAcceptedWork(
  tx: Tx,
  work: AcceptedWork,
  target: string,
  source: string,
  mode: 'continuation' | 'passive',
) {
  const taskId = decodeTaskId(work.taskId)
  const task = await tx.task(taskId)
  if (!task) throw new Error('Accepted native task no longer exists.')
  assertContinuationNotCancelled(task, mode)
  const marker = await tx.doc(AcceptedInputTaskDoc, taskId)
  if (
    !marker.accepted ||
    marker.conversationId !== work.conversationId ||
    marker.conversationId !== target ||
    (marker.source !== 'native' && marker.source !== source)
  )
    throw new Error('Delivery has no validated accepted-work lineage for this target.')
  // Native caller capture follows a validated owner chain. Source tasks are stamped only by
  // acceptTask in their creation transaction; their own native receipt remains authoritative.
  if (marker.nativeRun !== 0) {
    const run = await tx.task(decodeTaskId(String(marker.nativeRun)))
    if (!run || String(run.conversationId) !== marker.actorConversationId)
      throw new Error('Accepted-work native run lineage is missing.')
    assertContinuationNotCancelled(run, mode)
  }
  const origin =
    marker.originKind === 'agent'
      ? agentInputOrigin(marker.actorConversationId, marker.actorTaskId || undefined)
      : marker.originKind === 'mcp'
        ? mcpInputOrigin()
        : marker.originKind === 'human-action'
          ? componentActionOrigin()
          : scheduledInputOrigin(marker.source)
  return { source: marker.source, scopeId: marker.scopeId, origin }
}

function legacyPulseInput(task: NativeTaskRecord) {
  const input = task.input
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new Error(`Legacy Pulse task ${task.id} has invalid native input.`)
  const { reference, requestId } = input
  if (typeof reference !== 'object' || reference === null || Array.isArray(reference))
    throw new Error(`Legacy Pulse task ${task.id} has no native conversation reference.`)
  const { conversationId: target } = reference
  if (typeof target !== 'number' || !Number.isSafeInteger(target) || target < 1)
    throw new Error(`Legacy Pulse task ${task.id} has an invalid native conversation reference.`)
  return {
    conversationId: String(target),
    occurrenceId: typeof requestId === 'string' ? requestId : `legacy:${task.id}`,
  }
}

async function migrateAcceptedPulseTask(tx: Tx, task: NativeTaskRecord) {
  if (task.state.status === 'terminal') return
  const marker = await tx.doc(AcceptedInputTaskDoc, task.id)
  if (marker.accepted) return
  const { conversationId, occurrenceId } = legacyPulseInput(task)
  if (!(await tx.conversation(decodeConversationId(conversationId))))
    throw new Error(`Legacy Pulse task ${task.id} target is missing.`)
  await stampAcceptedInputTask(
    tx,
    {
      source: 'howcode.pulses',
      scopeId: '',
      occurrenceId,
      conversationId,
      kind: 'explicit',
      taskId: task.id,
    },
    task.startedAt ?? 0,
    { kind: 'scheduled', source: 'howcode.pulses' },
  )
}

/** Older native Pulse responsibilities were accepted before host provenance existed. */
export async function migrateAcceptedInputTasks(harness: Harness, context: Context) {
  let cursor: Cursor | undefined
  do {
    const page = await harness.commit(async (tx) => {
      const tasks = await tx.scanTasks({ kind: 'howaboua.pulses.run' }, 100, cursor)
      // Each task owns a different marker; native conversation reads are immutable.
      // Drain the bounded batch before rolling back any rejected migration.
      const migrations = await Promise.allSettled(
        tasks.items.map((task) => migrateAcceptedPulseTask(tx, task)),
      )
      const failed = migrations.find((result) => result.status === 'rejected')
      if (failed) throw failed.reason
      return tasks
    }, context)
    cursor = page.next
  } while (cursor !== undefined)
}
