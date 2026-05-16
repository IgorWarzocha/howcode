import { useEffect, useMemo, useRef } from 'react'
import {
  getEffectiveAccelerators,
  type KeybindingCommandId,
  type KeybindingOverrides,
} from '../../../shared/keybindings'
import type { Project, Thread } from '../types'
import {
  dispatchHowcodeKeybindingCommand,
  type HowcodeKeybindingCommandDetail,
  howcodeKeybindingCommandEvent,
} from './keybinding-events'
import type { AppShellController } from './useAppShellController'

const rendererCommandIds = new Set<KeybindingCommandId>([
  'app.commandPalette',
  'gitops.toggleChangedFiles',
  'terminal.clear',
  'dictation.toggle',
])

function eventTargetIsEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function eventTargetIsTerminal(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('.xterm') !== null
}

function eventTargetIsComposer(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('[data-composer-root="true"]') !== null
}

function interactiveLayerIsOpen() {
  return (
    document.querySelector(
      'dialog[open], [aria-modal="true"], [role="dialog"], [role="listbox"], .sidebar-popover-panel, .motion-popover',
    ) !== null
  )
}

function appLevelShortcutsAreBlocked(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  if (commandId === 'sidebar.toggle' || commandId === 'app.commandPalette') {
    return false
  }
  const { state } = runtime.appController
  if (commandId === 'settings.open') return state.settingsPanelOpen || interactiveLayerIsOpen()
  return (
    state.activeView === 'settings' ||
    state.settingsOpen ||
    state.settingsPanelOpen ||
    interactiveLayerIsOpen()
  )
}

function eventToAcceleratorCandidates(event: KeyboardEvent) {
  const parts: string[] = []
  const exactParts: string[] = []
  if (event.metaKey) exactParts.push('Cmd')
  if (event.ctrlKey) exactParts.push('Ctrl')
  if (event.metaKey || event.ctrlKey) parts.push('CmdOrCtrl')
  if (event.altKey) parts.push('Alt')
  if (event.altKey) exactParts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.shiftKey) exactParts.push('Shift')
  const key =
    event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  parts.push(key)
  exactParts.push(key)
  return [...new Set([exactParts.join('+'), parts.join('+')])]
}

function findSelectedThreadIndex(
  project: Project | null,
  selectedSessionPath: string | null,
  selectedThreadId: string | null,
) {
  if (!project) return -1
  return project.threads.findIndex((thread) => {
    if (selectedSessionPath && thread.sessionPath === selectedSessionPath) return true
    return selectedThreadId !== null && thread.id === selectedThreadId
  })
}

function getThreadSessionPath(thread: Thread) {
  return thread.sessionPath ?? thread.id
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

type KeybindingRuntime = {
  acceleratorToCommand: Map<string, KeybindingCommandId>
  appController: AppShellController
  onToggleSidebar: () => void
}

function stopActiveRun(runtime: KeybindingRuntime) {
  const { activeThreadData, composerProjectId, state } = runtime.appController
  if (!(activeThreadData?.isStreaming && state.selectedSessionPath)) return false
  if (appLevelShortcutsAreBlocked('agent.interrupt', runtime)) return false
  void runtime.appController.handleAction('composer.stop', {
    projectId: composerProjectId,
    sessionPath: state.selectedSessionPath,
  })
  return true
}

function handleEscape(
  event: KeyboardEvent,
  runtime: KeybindingRuntime,
  lastEscapeAtRef: React.MutableRefObject<number>,
) {
  const now = Date.now()
  const isDoubleEscape = now - lastEscapeAtRef.current < 650
  lastEscapeAtRef.current = now
  const commandId = runtime.acceleratorToCommand.get('Escape Escape')
  if (!(isDoubleEscape && commandId === 'agent.interrupt')) return
  if (!stopActiveRun(runtime)) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

function openAdjacentThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  const project =
    controller.projects.find((item) => item.id === controller.composerProjectId) ?? null
  const index = findSelectedThreadIndex(
    project,
    controller.state.selectedSessionPath,
    controller.state.selectedThreadId,
  )
  const nextThread = project?.threads[index + direction]
  if (!(project && nextThread)) return false
  controller.handleThreadOpen(
    project.id,
    nextThread.id,
    getThreadSessionPath(nextThread),
    controller.state.activeView === 'chat' ? 'chat' : 'thread',
  )
  return true
}

function handleProjectCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  if (commandId === 'thread.previousInProject') return openAdjacentThread(runtime, -1)
  if (commandId === 'thread.nextInProject') return openAdjacentThread(runtime, 1)
  return null
}

function handleRendererCommand(commandId: KeybindingCommandId) {
  if (!rendererCommandIds.has(commandId)) return false
  return dispatchHowcodeKeybindingCommand(commandId)
}

function handleSettingsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.state.activeView === 'settings') controller.handleShowLanding()
  else controller.handleShowView('settings')
  return true
}

function runAppCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  const controller = runtime.appController
  const projectHandled = handleProjectCommand(commandId, runtime)
  if (projectHandled !== null) return projectHandled
  if (commandId === 'settings.open') return handleSettingsCommand(runtime)
  if (commandId === 'sidebar.toggle') runtime.onToggleSidebar()
  else if (commandId === 'terminal.toggle') controller.handleToggleTerminal()
  else if (commandId === 'gitops.open') {
    if (controller.state.activeView === 'gitops') controller.handleCloseGitOpsView()
    else controller.handleOpenGitOpsView()
  } else if (commandId === 'thread.new') {
    void controller.handleAction('thread.new', {
      projectId: controller.composerProjectId,
      composerMode: controller.state.activeView === 'chat' ? 'chat' : 'code',
      chatGroupId: controller.selectedChatGroupId,
    })
  } else if (commandId === 'agent.interrupt') return stopActiveRun(runtime)
  else if (handleRendererCommand(commandId)) return true
  else if (commandId === 'thread.find') return false
  else return false
  return true
}

function handleShortcut(event: KeyboardEvent, runtime: KeybindingRuntime) {
  const commandId = eventToAcceleratorCandidates(event)
    .map((accelerator) => runtime.acceleratorToCommand.get(accelerator))
    .find((value): value is KeybindingCommandId => value !== undefined)
  if (!commandId) return
  if (appLevelShortcutsAreBlocked(commandId, runtime)) return
  if (
    eventTargetIsEditable(event.target) &&
    commandId !== 'settings.open' &&
    !(commandId === 'dictation.toggle' && eventTargetIsComposer(event.target)) &&
    !(commandId === 'terminal.clear' && eventTargetIsTerminal(event.target))
  ) {
    return
  }
  const handled = runAppCommand(commandId, runtime)
  if (!handled) return
  event.preventDefault()
}

export function useAppKeybindings(input: {
  controller: AppShellController
  keybindings: KeybindingOverrides
  onToggleSidebar: () => void
}) {
  const { controller, keybindings, onToggleSidebar } = input
  const acceleratorToCommand = useMemo(() => {
    const map = new Map<string, KeybindingCommandId>()
    for (const [commandId, accelerators] of getEffectiveAccelerators(keybindings)) {
      for (const accelerator of accelerators) {
        map.set(accelerator, commandId)
      }
    }
    return map
  }, [keybindings])
  const latest = useLatest({ acceleratorToCommand, appController: controller, onToggleSidebar })
  const lastEscapeAtRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape') handleEscape(event, latest.current, lastEscapeAtRef)
      else handleShortcut(event, latest.current)
    }
    const handleCommand = (event: Event) => {
      const commandId = (event as CustomEvent<HowcodeKeybindingCommandDetail>).detail?.commandId
      if (!commandId || rendererCommandIds.has(commandId)) return
      if (appLevelShortcutsAreBlocked(commandId, latest.current)) return
      runAppCommand(commandId, latest.current)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener(howcodeKeybindingCommandEvent, handleCommand)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener(howcodeKeybindingCommandEvent, handleCommand)
    }
  }, [latest])
}
