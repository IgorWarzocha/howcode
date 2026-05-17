import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import type { PiRuntime } from '../runtime/types.ts'
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  publishComposerUpdate,
  publishThreadUpdate,
  scheduleLiveThreadUpdate,
} from './live-thread-publisher.ts'
import { clearRuntimeToolProgress, rememberRuntimeToolProgress } from './live-tool-progress.ts'

type RuntimeSessionEvent = Parameters<Parameters<PiRuntime['session']['subscribe']>[0]>[0]
type RuntimeMessageEndEvent = Extract<RuntimeSessionEvent, { type: 'message_end' }>

type RuntimeSessionEventHandlers = {
  isRuntimeExtensionCommandRunning: (runtime: PiRuntime) => boolean
  reloadRuntimeSettingsIfSafe: (runtimeKey: string) => Promise<boolean>
  scheduleRuntimeDisposal: (runtimeKey: string) => void
  suspendRuntimeDisposal: (runtimeKey: string) => void
}

function publishRuntimeComposerState(runtime: PiRuntime, warning: string) {
  return buildComposerState(runtime)
    .then((composer) =>
      publishComposerUpdate(composer, {
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile,
      }),
    )
    .catch((error) => console.warn(warning, error))
}

function getRuntimeToolProgressPartial(event: RuntimeSessionEvent) {
  if (event.type === 'tool_execution_update') return event.partialResult
  if (event.type === 'tool_execution_end') return event.result
  return undefined
}

function handleRuntimeMessageEnd(
  runtime: PiRuntime,
  runtimeKey: string | null,
  event: RuntimeMessageEndEvent,
  handlers: RuntimeSessionEventHandlers,
) {
  if (event.message.role === 'user') {
    cancelLiveThreadUpdate(runtime)
    void publishThreadUpdate(runtime, 'start')
  } else {
    if (event.message.role === 'toolResult') {
      const toolCallId = 'toolCallId' in event.message ? event.message.toolCallId : undefined
      clearRuntimeToolProgress(runtime, {
        toolCallId: typeof toolCallId === 'string' ? toolCallId : undefined,
        toolName: event.message.toolName,
      })
    }
    deferLiveThreadUpdate(runtime, { requireStreaming: event.message.role === 'toolResult' })
  }
  if (runtimeKey) handlers.scheduleRuntimeDisposal(runtimeKey)
}

export function handleRuntimeSessionEvent(
  runtime: PiRuntime,
  event: RuntimeSessionEvent,
  handlers: RuntimeSessionEventHandlers,
) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) handlers.suspendRuntimeDisposal(runtimeKey)
  switch (event.type) {
    case 'message_start':
    case 'message_update':
      scheduleLiveThreadUpdate(runtime)
      return
    case 'message_end':
      handleRuntimeMessageEnd(runtime, runtimeKey, event, handlers)
      return
    case 'agent_end':
      cancelLiveThreadUpdate(runtime)
      void publishThreadUpdate(runtime, 'end')
      if (runtimeKey)
        void handlers
          .reloadRuntimeSettingsIfSafe(runtimeKey)
          .finally(() => handlers.scheduleRuntimeDisposal(runtimeKey))
      return
    case 'compaction_start':
      cancelLiveThreadUpdate(runtime)
      void publishThreadUpdate(runtime, 'compaction-start')
      void publishRuntimeComposerState(
        runtime,
        'Failed to publish composer state after compaction start',
      )
      return
    case 'compaction_end':
      setTimeout(() => {
        cancelLiveThreadUpdate(runtime)
        void publishThreadUpdate(runtime, 'compaction')
        void publishRuntimeComposerState(
          runtime,
          'Failed to publish composer state after compaction end',
        ).finally(() => {
          if (runtimeKey)
            void handlers
              .reloadRuntimeSettingsIfSafe(runtimeKey)
              .finally(() => handlers.scheduleRuntimeDisposal(runtimeKey))
        })
      }, 0)
      return
    case 'tool_execution_start':
    case 'tool_execution_update':
    case 'tool_execution_end':
      rememberRuntimeToolProgress(runtime, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: 'args' in event ? event.args : undefined,
        partialResult: getRuntimeToolProgressPartial(event),
        isError: event.type === 'tool_execution_end' ? event.isError : false,
        terminal: event.type === 'tool_execution_end',
      })
      scheduleLiveThreadUpdate(runtime)
      return
    case 'queue_update':
      void publishRuntimeComposerState(
        runtime,
        'Failed to publish composer state after queue update',
      ).finally(() => {
        if (runtimeKey && !runtime.session.isStreaming) handlers.scheduleRuntimeDisposal(runtimeKey)
      })
      return
    default:
      return
  }
}
