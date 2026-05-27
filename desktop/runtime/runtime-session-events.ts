import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { buildComposerState } from './composer-state.ts'
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  scheduleLiveThreadUpdate,
  scheduleRuntimeDisposal,
  suspendRuntimeDisposal,
} from './registry/runtime-registry-state.ts'
import { clearRuntimeToolProgress, rememberRuntimeToolProgress } from './thread-publisher.ts'
import type { PiRuntime } from './types.ts'

type RuntimeSessionEvent = Parameters<Parameters<PiRuntime['session']['subscribe']>[0]>[0]

type RuntimeSessionEventHandlers = {
  isRuntimeBusy: (runtime: PiRuntime) => boolean
  reloadRuntimeSettingsIfSafe: (
    runtimeKey: string,
    options?: { useMutationLock?: boolean | undefined },
  ) => Promise<boolean>
  isRuntimeSettingsStale: (runtimeKey: string) => boolean
  publishComposerUpdate: (
    composer: Awaited<ReturnType<typeof buildComposerState>>,
    context: { projectId?: string | null | undefined; sessionPath?: string | null | undefined },
  ) => void
  publishThreadUpdate: (
    runtime: PiRuntime,
    reason: 'start' | 'update' | 'end' | 'compaction-start' | 'compaction',
  ) => Promise<void>
}

function publishRuntimeComposerState(runtime: PiRuntime, handlers: RuntimeSessionEventHandlers) {
  return buildComposerState(runtime)
    .then((composer) => {
      handlers.publishComposerUpdate(composer, {
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile,
      })
    })
    .catch(() => {
      // Ignore transient composer snapshot errors; a later runtime event will republish state.
    })
}

function publishLiveThreadUpdate(runtime: PiRuntime, handlers: RuntimeSessionEventHandlers) {
  void handlers.publishThreadUpdate(runtime, 'update')
}

function getRuntimeToolProgressPartial(event: RuntimeSessionEvent) {
  if (event.type === 'tool_execution_update') return event.partialResult
  if (event.type === 'tool_execution_end') return event.result
  return undefined
}

function handleRuntimeMessageEnd(
  runtime: PiRuntime,
  runtimeKey: string | null,
  event: Extract<RuntimeSessionEvent, { type: 'message_end' }>,
  handlers: RuntimeSessionEventHandlers,
) {
  if (event.message.role === 'user') {
    cancelLiveThreadUpdate(runtime)
    void handlers.publishThreadUpdate(runtime, 'start')
  } else {
    if (event.message.role === 'toolResult') {
      const toolCallId = 'toolCallId' in event.message ? event.message.toolCallId : undefined
      clearRuntimeToolProgress(runtime, {
        toolCallId: typeof toolCallId === 'string' ? toolCallId : undefined,
        toolName: event.message.toolName,
      })
    }
    deferLiveThreadUpdate(
      runtime,
      (activeRuntime) => publishLiveThreadUpdate(activeRuntime, handlers),
      {
        requireStreaming: event.message.role === 'toolResult',
      },
    )
  }
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey, handlers.isRuntimeBusy)
}

function handleRuntimeAgentEnd(
  runtime: PiRuntime,
  runtimeKey: string | null,
  handlers: RuntimeSessionEventHandlers,
) {
  cancelLiveThreadUpdate(runtime)
  void handlers.publishThreadUpdate(runtime, 'end')
  if (runtimeKey && handlers.isRuntimeSettingsStale(runtimeKey))
    void handlers.reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => undefined)
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey, handlers.isRuntimeBusy)
}

function handleRuntimeCompactionEnd(
  runtime: PiRuntime,
  runtimeKey: string | null,
  handlers: RuntimeSessionEventHandlers,
) {
  setTimeout(() => {
    cancelLiveThreadUpdate(runtime)
    void handlers.publishThreadUpdate(runtime, 'compaction')
    void publishRuntimeComposerState(runtime, handlers)
  }, 0)
  if (runtimeKey && handlers.isRuntimeSettingsStale(runtimeKey))
    void handlers.reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => undefined)
}

function handleRuntimeToolEvent(
  runtime: PiRuntime,
  event: Extract<
    RuntimeSessionEvent,
    { type: 'tool_execution_start' | 'tool_execution_update' | 'tool_execution_end' }
  >,
  handlers: RuntimeSessionEventHandlers,
) {
  rememberRuntimeToolProgress(runtime, {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: 'args' in event ? event.args : undefined,
    partialResult: getRuntimeToolProgressPartial(event),
    isError: event.type === 'tool_execution_end' ? event.isError : false,
    terminal: event.type === 'tool_execution_end',
  })
  scheduleLiveThreadUpdate(runtime, (activeRuntime) =>
    publishLiveThreadUpdate(activeRuntime, handlers),
  )
}

export function handleRuntimeSessionEvent(
  runtime: PiRuntime,
  event: RuntimeSessionEvent,
  handlers: RuntimeSessionEventHandlers,
) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) suspendRuntimeDisposal(runtimeKey)
  if (event.type === 'message_start' || event.type === 'message_update')
    return scheduleLiveThreadUpdate(runtime, (activeRuntime) =>
      publishLiveThreadUpdate(activeRuntime, handlers),
    )
  if (event.type === 'message_end')
    return handleRuntimeMessageEnd(runtime, runtimeKey, event, handlers)
  if (event.type === 'agent_end') return handleRuntimeAgentEnd(runtime, runtimeKey, handlers)
  if (event.type === 'compaction_start') {
    cancelLiveThreadUpdate(runtime)
    void handlers.publishThreadUpdate(runtime, 'compaction-start')
    void publishRuntimeComposerState(runtime, handlers)
    return
  }
  if (event.type === 'compaction_end')
    return handleRuntimeCompactionEnd(runtime, runtimeKey, handlers)
  if (
    event.type === 'tool_execution_start' ||
    event.type === 'tool_execution_update' ||
    event.type === 'tool_execution_end'
  )
    return handleRuntimeToolEvent(runtime, event, handlers)
  if (event.type === 'queue_update')
    void publishRuntimeComposerState(runtime, handlers).finally(() => {
      if (runtimeKey && !runtime.session.isStreaming)
        scheduleRuntimeDisposal(runtimeKey, handlers.isRuntimeBusy)
    })
}
