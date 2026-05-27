const extensionSourceSuffixPattern = /\.(ts|js)$/

import path from 'node:path'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import {
  bindHeadlessAgentSessionExtensions,
  refreshHeadlessAgentSessionExtensionBindings,
} from '../runtime/agent-session-extensions.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import type { PiRuntime } from '../runtime/types.ts'
import { emitDesktopEvent } from './host-events.ts'
import { publishComposerUpdate, publishThreadUpdate } from './live-thread-publisher.ts'

type RuntimeExtensionBindingHandlers = {
  isRuntimeExtensionCommandRunning: (runtime: PiRuntime) => boolean
  reloadRuntimeSettingsIfSafe: (runtimeKey: string) => Promise<boolean>
}

function getRuntimeDiagnosticExtensionLabel(extensionPath: string) {
  if (extensionPath.startsWith('command:')) return `/${extensionPath.slice('command:'.length)}`
  if (extensionPath.startsWith('<')) return extensionPath.replace(/[<>]/g, '')
  return path.basename(extensionPath).replace(extensionSourceSuffixPattern, '')
}

function publishRuntimeExtensionCommandState(
  runtime: PiRuntime,
  handlers: RuntimeExtensionBindingHandlers,
) {
  void buildComposerState(runtime)
    .then((composer) =>
      publishComposerUpdate(composer, {
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile,
      }),
    )
    .catch((error) => console.warn('Failed to publish extension command state', error))

  if (handlers.isRuntimeExtensionCommandRunning(runtime)) return
  void publishThreadUpdate(runtime, 'compaction').catch(() => {
    // Branch summaries can reuse Pi's compaction state without emitting compaction_end.
    // Clear the live thread state when the extension command itself has finished.
  })
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) {
    void handlers.reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
      // Keep stale settings marked; the next safe point retries silently.
    })
  }
}

export async function bindRuntimeExtensionHandlers(
  runtime: PiRuntime,
  handlers: RuntimeExtensionBindingHandlers,
) {
  await bindHeadlessAgentSessionExtensions(runtime.session, {
    onExtensionCommandStateChange: () => publishRuntimeExtensionCommandState(runtime, handlers),
    onExtensionError: (error) => {
      const extensionLabel = getRuntimeDiagnosticExtensionLabel(error.extensionPath)
      emitDesktopEvent({
        type: 'runtime-diagnostic',
        severity: 'error',
        message: `${extensionLabel} extension error: ${error.error}`,
        details: { ...error, extensionLabel },
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile ?? null,
      })
    },
  })
}

export async function refreshRuntimeExtensionHandlers(
  runtime: PiRuntime,
  handlers: RuntimeExtensionBindingHandlers,
) {
  await refreshHeadlessAgentSessionExtensionBindings(runtime.session, {
    onExtensionCommandStateChange: () => publishRuntimeExtensionCommandState(runtime, handlers),
  })
}
