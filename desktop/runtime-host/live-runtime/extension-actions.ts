import type { ComposerStateRequest } from '../../../shared/desktop-contracts.ts'
import { getPersistedSessionPath } from '../../../shared/session-paths.ts'
import { buildComposerState } from '../../runtime/composer-state.ts'
import {
  answerPiExtensionDialog as answerPiExtensionDialogForRuntime,
  bindPiExtensionEditorState,
} from '../../runtime/pi-extension-ui-state.ts'
import {
  getOrCreateRuntimeForSessionPath,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
} from '../live-runtime-registry.ts'
import { publishComposerUpdate, publishPiExtensionUiUpdate } from '../live-thread-publisher.ts'
import { emitComposerUpdate, scheduleRuntimeDisposalForRuntime } from './composer-updates.ts'

export async function answerPiExtensionDialog(
  request: ComposerStateRequest & {
    requestId: string
    cancelled?: boolean | undefined
    confirmed?: boolean | undefined
    value?: string | undefined
  },
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: false }

  try {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    const ok = answerPiExtensionDialogForRuntime(runtime, request.requestId, {
      cancelled: request.cancelled,
      confirmed: request.confirmed,
      value: request.value,
    })
    publishPiExtensionUiUpdate(runtime)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
    return { ok }
  } finally {
    scheduleRuntimeDisposal(persistedSessionPath)
  }
}

export async function invokePiExtensionShortcut(
  request: ComposerStateRequest & {
    editorSelectionEnd?: number | undefined
    editorSelectionStart?: number | undefined
    editorText?: string | undefined
    shortcut: string
  },
): Promise<{
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText?: string | undefined
  ok: boolean
}> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: false }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    try {
      const shortcut = runtime.session.extensionRunner
        .getShortcuts({} as never)
        .get(request.shortcut.toLowerCase() as never)
      if (!shortcut) return { ok: false }
      const unbindEditorState = bindPiExtensionEditorState(runtime, {
        changed: false,
        selectionEnd: request.editorSelectionEnd ?? request.editorText?.length ?? 0,
        selectionStart: request.editorSelectionStart ?? request.editorText?.length ?? 0,
        text: request.editorText ?? '',
      })
      let editorState: ReturnType<typeof unbindEditorState>
      try {
        await shortcut.handler(runtime.session.extensionRunner.createContext())
      } finally {
        editorState = unbindEditorState()
      }
      const composer = await buildComposerState(runtime)
      publishComposerUpdate(composer, {
        projectId: request.projectId ?? runtime.cwd,
        sessionPath: persistedSessionPath,
      })
      return editorState.changed
        ? {
            editorSelectionEnd: editorState.selectionEnd,
            editorSelectionStart: editorState.selectionStart,
            editorText: editorState.text,
            ok: true,
          }
        : { ok: true }
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime)
    }
  })
}
