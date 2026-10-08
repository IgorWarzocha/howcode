import { getPersistedConversationId, isLocalConversationId } from '@howcode/shared/conversation-ids'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ChatData,
  DesktopActionInvoker,
  DirectoryDiffBaseline,
  DirectoryDiffRenderMode,
  ShellState,
} from '../../../../src/app/desktop/types'
import { useLatestRef } from '../../../../src/app/hooks/useLatestRef'
import { defaultDiffBaseline } from '../gitops/index'

type DiffPreferencesHost = {
  desktop: { shellState: ShellState | null; handleAction: DesktopActionInvoker }
  chat: { activeData: ChatData | null }
}

type DiffPreferenceSource = 'init' | 'override' | 'default'

type DiffPreferenceScope = {
  directoryId: string
  chatId: string | null
  conversationId: string | null
}

type DiffBaselineState = DiffPreferenceScope & {
  baseline: DirectoryDiffBaseline
  source: DiffPreferenceSource
}

type DiffRenderModeState = DiffPreferenceScope & {
  renderMode: DirectoryDiffRenderMode
  source: DiffPreferenceSource
}

export function areDiffBaselinesEqual(left: DirectoryDiffBaseline, right: DirectoryDiffBaseline) {
  if (left.kind !== right.kind) return false
  if (left.kind === 'commit' && right.kind === 'commit') return left.sha === right.sha
  if (left.kind === 'last-opened' && right.kind === 'last-opened') return left.rev === right.rev
  if (left.kind === 'branch' && right.kind === 'branch') return left.branchName === right.branchName
  if (left.kind === 'parent-branch' && right.kind === 'parent-branch') {
    return left.branchName === right.branchName
  }
  return true
}

function isSameDraftPromotion({
  activeChatId,
  messageCount,
  previousConversationId,
  previousChatId,
  nextConversationId,
}: {
  activeChatId: string | null
  messageCount: number | null
  previousConversationId: string | null
  previousChatId: string | null
  nextConversationId: string | null
}) {
  return (
    isLocalConversationId(previousConversationId) &&
    previousChatId?.startsWith('local-thread-') &&
    activeChatId !== null &&
    getPersistedConversationId(nextConversationId) !== null &&
    (messageCount === null || messageCount <= 1)
  )
}

function getNextDiffBaseline(controller: DiffPreferencesHost) {
  return (
    controller.chat.activeData?.diffPreferences?.baseline ??
    controller.desktop.shellState?.appSettings.gitDiffBaselineDefault ??
    defaultDiffBaseline
  )
}

function getEffectiveDiffBaseline(input: {
  baseline: DirectoryDiffBaseline
  parentBranchName: string | null
}): DirectoryDiffBaseline {
  return input.baseline.kind === 'main-branch' && input.parentBranchName
    ? ({
        kind: 'parent-branch',
        branchName: input.parentBranchName,
      } satisfies DirectoryDiffBaseline)
    : input.baseline
}

function getNextDiffRenderMode(controller: DiffPreferencesHost) {
  return (
    controller.chat.activeData?.diffPreferences?.renderMode ??
    controller.desktop.shellState?.appSettings.gitDiffRenderModeDefault ??
    'stacked'
  )
}

function scopeMatches(scope: DiffPreferenceScope, next: DiffPreferenceScope) {
  return (
    scope.directoryId === next.directoryId &&
    scope.chatId === next.chatId &&
    scope.conversationId === next.conversationId
  )
}

function promoteDiffBaselineDraft(options: {
  activeChatId: string | null
  controllerRef: React.RefObject<DiffPreferencesHost>
  current: DiffBaselineState
  parentBranchName: string | null
  terminalConversationId: string | null
}) {
  const appDefault =
    options.controllerRef.current.desktop.shellState?.appSettings.gitDiffBaselineDefault
  const effectiveDefault = getEffectiveDiffBaseline({
    baseline: appDefault ?? defaultDiffBaseline,
    parentBranchName: options.parentBranchName,
  })
  const promotedBaseline =
    effectiveDefault && areDiffBaselinesEqual(options.current.baseline, effectiveDefault)
      ? null
      : options.current.baseline
  void options.controllerRef.current.desktop.handleAction('git.diff-preferences', {
    diffBaseline: promotedBaseline,
  })
  return {
    ...options.current,
    chatId: options.activeChatId,
    conversationId: options.terminalConversationId,
  }
}

function nextDiffBaselineState(options: {
  activeChatId: string | null
  composerDirectoryId: string
  controller: DiffPreferencesHost
  controllerRef: React.RefObject<DiffPreferencesHost>
  current: DiffBaselineState
  parentBranchName: string | null
  terminalConversationId: string | null
}) {
  const nextBaseline = getEffectiveDiffBaseline({
    baseline: getNextDiffBaseline(options.controller),
    parentBranchName: options.parentBranchName,
  })
  if (
    options.current.directoryId === options.composerDirectoryId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeChatId: options.activeChatId,
      messageCount: options.controller.chat.activeData?.messages.length ?? null,
      previousConversationId: options.current.conversationId,
      previousChatId: options.current.chatId,
      nextConversationId: options.terminalConversationId,
    })
  ) {
    return promoteDiffBaselineDraft(options)
  }

  const nextScope = {
    directoryId: options.composerDirectoryId,
    chatId: options.activeChatId,
    conversationId: options.terminalConversationId,
  }
  if (
    scopeMatches(options.current, nextScope) &&
    (options.current.source === 'override' ||
      areDiffBaselinesEqual(options.current.baseline, nextBaseline))
  ) {
    return options.current
  }

  return { ...nextScope, baseline: nextBaseline, source: 'init' as const }
}

function promoteDiffRenderModeDraft(options: {
  activeChatId: string | null
  controllerRef: React.RefObject<DiffPreferencesHost>
  current: DiffRenderModeState
  terminalConversationId: string | null
}) {
  const appDefault =
    options.controllerRef.current.desktop.shellState?.appSettings.gitDiffRenderModeDefault
  const promotedRenderMode =
    appDefault === options.current.renderMode ? null : options.current.renderMode
  void options.controllerRef.current.desktop.handleAction('git.diff-preferences', {
    diffRenderMode: promotedRenderMode,
  })
  return {
    ...options.current,
    chatId: options.activeChatId,
    conversationId: options.terminalConversationId,
  }
}

function nextDiffRenderModeState(options: {
  activeChatId: string | null
  composerDirectoryId: string
  controller: DiffPreferencesHost
  controllerRef: React.RefObject<DiffPreferencesHost>
  current: DiffRenderModeState
  terminalConversationId: string | null
}) {
  const nextRenderMode = getNextDiffRenderMode(options.controller)
  if (
    options.current.directoryId === options.composerDirectoryId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeChatId: options.activeChatId,
      messageCount: options.controller.chat.activeData?.messages.length ?? null,
      previousConversationId: options.current.conversationId,
      previousChatId: options.current.chatId,
      nextConversationId: options.terminalConversationId,
    })
  ) {
    return promoteDiffRenderModeDraft(options)
  }

  const nextScope = {
    directoryId: options.composerDirectoryId,
    chatId: options.activeChatId,
    conversationId: options.terminalConversationId,
  }
  if (
    scopeMatches(options.current, nextScope) &&
    (options.current.source === 'override' || options.current.renderMode === nextRenderMode)
  ) {
    return options.current
  }

  return { ...nextScope, renderMode: nextRenderMode, source: 'init' as const }
}

export function useAppShellDiffPreferences({
  activeChatId,
  composerDirectoryId,
  controller,
  parentBranchName,
  terminalConversationId,
}: {
  activeChatId: string | null
  composerDirectoryId: string
  controller: DiffPreferencesHost
  parentBranchName: string | null
  terminalConversationId: string | null
}) {
  const controllerRef = useLatestRef(controller)
  const scope = useMemo(
    () => ({
      directoryId: composerDirectoryId,
      chatId: activeChatId,
      conversationId: terminalConversationId,
    }),
    [activeChatId, composerDirectoryId, terminalConversationId],
  )
  const [diffBaselineState, setDiffBaselineState] = useState<DiffBaselineState>({
    directoryId: '',
    chatId: null,
    conversationId: null,
    baseline: defaultDiffBaseline,
    source: 'init',
  })
  const [diffRenderModeState, setDiffRenderModeState] = useState<DiffRenderModeState>({
    directoryId: '',
    chatId: null,
    conversationId: null,
    renderMode: 'stacked',
    source: 'init',
  })

  useEffect(() => {
    setDiffBaselineState((current) =>
      nextDiffBaselineState({
        activeChatId,
        composerDirectoryId,
        controller,
        controllerRef,
        current,
        parentBranchName,
        terminalConversationId,
      }),
    )
  }, [
    activeChatId,
    composerDirectoryId,
    controller,
    controllerRef,
    parentBranchName,
    terminalConversationId,
  ])

  useEffect(() => {
    setDiffRenderModeState((current) =>
      nextDiffRenderModeState({
        activeChatId,
        composerDirectoryId,
        controller,
        controllerRef,
        current,
        terminalConversationId,
      }),
    )
  }, [activeChatId, composerDirectoryId, controller, controllerRef, terminalConversationId])

  const diffBaseline = scopeMatches(diffBaselineState, scope)
    ? diffBaselineState.baseline
    : getEffectiveDiffBaseline({ baseline: getNextDiffBaseline(controller), parentBranchName })
  const diffRenderMode = scopeMatches(diffRenderModeState, scope)
    ? diffRenderModeState.renderMode
    : getNextDiffRenderMode(controller)

  const handleSetDiffBaseline = useCallback(
    (baseline: DirectoryDiffBaseline) => {
      const appDefault =
        controllerRef.current.desktop.shellState?.appSettings.gitDiffBaselineDefault
      const effectiveDefault = getEffectiveDiffBaseline({
        baseline: appDefault ?? defaultDiffBaseline,
        parentBranchName,
      })
      const nextBaseline =
        effectiveDefault && areDiffBaselinesEqual(baseline, effectiveDefault) ? null : baseline
      setDiffBaselineState({ ...scope, baseline, source: nextBaseline ? 'override' : 'default' })
      void controllerRef.current.desktop.handleAction('git.diff-preferences', {
        diffBaseline: nextBaseline,
      })
    },
    [controllerRef, parentBranchName, scope],
  )

  const handleSetDiffRenderMode = useCallback(
    (renderMode: DirectoryDiffRenderMode) => {
      const appDefault =
        controllerRef.current.desktop.shellState?.appSettings.gitDiffRenderModeDefault
      const nextRenderMode = appDefault === renderMode ? null : renderMode
      setDiffRenderModeState({
        ...scope,
        renderMode,
        source: nextRenderMode ? 'override' : 'default',
      })
      void controllerRef.current.desktop.handleAction('git.diff-preferences', {
        diffRenderMode: nextRenderMode,
      })
    },
    [controllerRef, scope],
  )

  return { diffBaseline, diffRenderMode, handleSetDiffBaseline, handleSetDiffRenderMode }
}
