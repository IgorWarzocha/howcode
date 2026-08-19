import { defaultDiffBaseline } from '@howcode/native-gitops'
import { getPersistedSessionPath, isLocalSessionPath } from '@howcode/shared/session-paths'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { useLatestRef } from '../hooks/useLatestRef'
import type { AppShellController } from './useAppShellController'

type DiffPreferenceSource = 'init' | 'override' | 'default'

type DiffPreferenceScope = {
  projectId: string
  threadId: string | null
  sessionPath: string | null
}

type DiffBaselineState = DiffPreferenceScope & {
  baseline: ProjectDiffBaseline
  source: DiffPreferenceSource
}

type DiffRenderModeState = DiffPreferenceScope & {
  renderMode: ProjectDiffRenderMode
  source: DiffPreferenceSource
}

export function areDiffBaselinesEqual(left: ProjectDiffBaseline, right: ProjectDiffBaseline) {
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
  activeThreadId,
  messageCount,
  previousSessionPath,
  previousThreadId,
  nextSessionPath,
}: {
  activeThreadId: string | null
  messageCount: number | null
  previousSessionPath: string | null
  previousThreadId: string | null
  nextSessionPath: string | null
}) {
  return (
    isLocalSessionPath(previousSessionPath) &&
    previousThreadId?.startsWith('local-thread-') &&
    activeThreadId !== null &&
    getPersistedSessionPath(nextSessionPath) !== null &&
    (messageCount === null || messageCount <= 1)
  )
}

function getNextDiffBaseline(controller: AppShellController) {
  return (
    controller.thread.activeData?.diffPreferences?.baseline ??
    controller.desktop.shellState?.appSettings.gitDiffBaselineDefault ??
    defaultDiffBaseline
  )
}

function getEffectiveDiffBaseline(input: {
  baseline: ProjectDiffBaseline
  parentBranchName: string | null
}): ProjectDiffBaseline {
  return input.baseline.kind === 'main-branch' && input.parentBranchName
    ? ({ kind: 'parent-branch', branchName: input.parentBranchName } satisfies ProjectDiffBaseline)
    : input.baseline
}

function getNextDiffRenderMode(controller: AppShellController) {
  return (
    controller.thread.activeData?.diffPreferences?.renderMode ??
    controller.desktop.shellState?.appSettings.gitDiffRenderModeDefault ??
    'stacked'
  )
}

function scopeMatches(scope: DiffPreferenceScope, next: DiffPreferenceScope) {
  return (
    scope.projectId === next.projectId &&
    scope.threadId === next.threadId &&
    scope.sessionPath === next.sessionPath
  )
}

function promoteDiffBaselineDraft(options: {
  activeThreadId: string | null
  controllerRef: React.RefObject<AppShellController>
  current: DiffBaselineState
  parentBranchName: string | null
  terminalSessionPath: string | null
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
  void options.controllerRef.current.desktop.handleAction('workspace.diff-preferences', {
    diffBaseline: promotedBaseline,
  })
  return {
    ...options.current,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
  }
}

function nextDiffBaselineState(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  controllerRef: React.RefObject<AppShellController>
  current: DiffBaselineState
  parentBranchName: string | null
  terminalSessionPath: string | null
}) {
  const nextBaseline = getEffectiveDiffBaseline({
    baseline: getNextDiffBaseline(options.controller),
    parentBranchName: options.parentBranchName,
  })
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeThreadId: options.activeThreadId,
      messageCount: options.controller.thread.activeData?.messages.length ?? null,
      previousSessionPath: options.current.sessionPath,
      previousThreadId: options.current.threadId,
      nextSessionPath: options.terminalSessionPath,
    })
  ) {
    return promoteDiffBaselineDraft(options)
  }

  const nextScope = {
    projectId: options.composerProjectId,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
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
  activeThreadId: string | null
  controllerRef: React.RefObject<AppShellController>
  current: DiffRenderModeState
  terminalSessionPath: string | null
}) {
  const appDefault =
    options.controllerRef.current.desktop.shellState?.appSettings.gitDiffRenderModeDefault
  const promotedRenderMode =
    appDefault === options.current.renderMode ? null : options.current.renderMode
  void options.controllerRef.current.desktop.handleAction('workspace.diff-preferences', {
    diffRenderMode: promotedRenderMode,
  })
  return {
    ...options.current,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
  }
}

function nextDiffRenderModeState(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  controllerRef: React.RefObject<AppShellController>
  current: DiffRenderModeState
  terminalSessionPath: string | null
}) {
  const nextRenderMode = getNextDiffRenderMode(options.controller)
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeThreadId: options.activeThreadId,
      messageCount: options.controller.thread.activeData?.messages.length ?? null,
      previousSessionPath: options.current.sessionPath,
      previousThreadId: options.current.threadId,
      nextSessionPath: options.terminalSessionPath,
    })
  ) {
    return promoteDiffRenderModeDraft(options)
  }

  const nextScope = {
    projectId: options.composerProjectId,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
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
  activeThreadId,
  composerProjectId,
  controller,
  parentBranchName,
  terminalSessionPath,
}: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  parentBranchName: string | null
  terminalSessionPath: string | null
}) {
  const controllerRef = useLatestRef(controller)
  const scope = useMemo(
    () => ({
      projectId: composerProjectId,
      threadId: activeThreadId,
      sessionPath: terminalSessionPath,
    }),
    [activeThreadId, composerProjectId, terminalSessionPath],
  )
  const [diffBaselineState, setDiffBaselineState] = useState<DiffBaselineState>({
    projectId: '',
    threadId: null,
    sessionPath: null,
    baseline: defaultDiffBaseline,
    source: 'init',
  })
  const [diffRenderModeState, setDiffRenderModeState] = useState<DiffRenderModeState>({
    projectId: '',
    threadId: null,
    sessionPath: null,
    renderMode: 'stacked',
    source: 'init',
  })

  useEffect(() => {
    setDiffBaselineState((current) =>
      nextDiffBaselineState({
        activeThreadId,
        composerProjectId,
        controller,
        controllerRef,
        current,
        parentBranchName,
        terminalSessionPath,
      }),
    )
  }, [
    activeThreadId,
    composerProjectId,
    controller,
    controllerRef,
    parentBranchName,
    terminalSessionPath,
  ])

  useEffect(() => {
    setDiffRenderModeState((current) =>
      nextDiffRenderModeState({
        activeThreadId,
        composerProjectId,
        controller,
        controllerRef,
        current,
        terminalSessionPath,
      }),
    )
  }, [activeThreadId, composerProjectId, controller, controllerRef, terminalSessionPath])

  const diffBaseline = scopeMatches(diffBaselineState, scope)
    ? diffBaselineState.baseline
    : getEffectiveDiffBaseline({ baseline: getNextDiffBaseline(controller), parentBranchName })
  const diffRenderMode = scopeMatches(diffRenderModeState, scope)
    ? diffRenderModeState.renderMode
    : getNextDiffRenderMode(controller)

  const handleSetDiffBaseline = useCallback(
    (baseline: ProjectDiffBaseline) => {
      const appDefault =
        controllerRef.current.desktop.shellState?.appSettings.gitDiffBaselineDefault
      const effectiveDefault = getEffectiveDiffBaseline({
        baseline: appDefault ?? defaultDiffBaseline,
        parentBranchName,
      })
      const nextBaseline =
        effectiveDefault && areDiffBaselinesEqual(baseline, effectiveDefault) ? null : baseline
      setDiffBaselineState({ ...scope, baseline, source: nextBaseline ? 'override' : 'default' })
      void controllerRef.current.desktop.handleAction('workspace.diff-preferences', {
        diffBaseline: nextBaseline,
      })
    },
    [controllerRef, parentBranchName, scope],
  )

  const handleSetDiffRenderMode = useCallback(
    (renderMode: ProjectDiffRenderMode) => {
      const appDefault =
        controllerRef.current.desktop.shellState?.appSettings.gitDiffRenderModeDefault
      const nextRenderMode = appDefault === renderMode ? null : renderMode
      setDiffRenderModeState({
        ...scope,
        renderMode,
        source: nextRenderMode ? 'override' : 'default',
      })
      void controllerRef.current.desktop.handleAction('workspace.diff-preferences', {
        diffRenderMode: nextRenderMode,
      })
    },
    [controllerRef, scope],
  )

  return { diffBaseline, diffRenderMode, handleSetDiffBaseline, handleSetDiffRenderMode }
}
