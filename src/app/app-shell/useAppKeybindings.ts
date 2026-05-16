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
const keyboardCodeLetterPattern = /^Key[A-Z]$/
const keyboardCodeDigitPattern = /^Digit\d$/

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

function getKeyboardEventKey(event: KeyboardEvent) {
  if (keyboardCodeLetterPattern.test(event.code)) return event.code.slice(3)
  if (keyboardCodeDigitPattern.test(event.code)) return event.code.slice(5)
  if (event.code === 'BracketLeft') return '['
  if (event.code === 'BracketRight') return ']'
  if (event.key === ' ') return 'Space'
  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

function dictationShortcutIsAllowed(event: KeyboardEvent, runtime: KeybindingRuntime) {
  return (
    eventTargetIsComposer(event.target) ||
    runtime.appController.state.activeView === 'gitops' ||
    runtime.appController.state.activeView === 'inbox'
  )
}

function commandCanRunFromEditableTarget(
  commandId: KeybindingCommandId,
  event: KeyboardEvent,
  runtime: KeybindingRuntime,
) {
  if (commandId === 'settings.open') return true
  if (commandId === 'terminal.toggle') return eventTargetIsTerminal(event.target)
  if (commandId === 'dictation.toggle') return dictationShortcutIsAllowed(event, runtime)
  if (commandId === 'terminal.clear') return runtime.appController.state.terminalVisible
  if (commandId === 'thread.previousInProject' || commandId === 'thread.nextInProject') return true
  return false
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
  if (commandId === 'terminal.toggle') {
    return state.activeView === 'settings' || state.settingsOpen || state.settingsPanelOpen
  }
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
  const key = getKeyboardEventKey(event)
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

function getAdjacentIndex(currentIndex: number, length: number, direction: -1 | 1) {
  if (length === 0) return -1
  if (currentIndex < 0) return direction > 0 ? 0 : length - 1
  return (currentIndex + direction + length) % length
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
  if (!(controller.state.activeView === 'thread' || controller.state.activeView === 'code')) {
    return false
  }
  const project =
    controller.projects.find(
      (item) => item.id === (controller.state.selectedProjectId || controller.composerProjectId),
    ) ?? null
  const index = findSelectedThreadIndex(
    project,
    controller.state.selectedSessionPath,
    controller.state.selectedThreadId,
  )
  if (!(project && project.threads.length > 0)) return false
  const nextIndex = getAdjacentIndex(index, project.threads.length, direction)
  const nextThread = project.threads[nextIndex]
  if (!nextThread) return false
  controller.handleThreadOpen(project.id, nextThread.id, getThreadSessionPath(nextThread), 'thread')
  return true
}

function getChatThreads(runtime: KeybindingRuntime) {
  const chatState = runtime.appController.chatSidebarState
  if (!chatState) return []
  return [...chatState.ungroupedThreads, ...chatState.groups.flatMap((group) => group.threads)]
}

function openAdjacentChatThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.state.activeView !== 'chat') return null
  const threads = getChatThreads(runtime)
  const index = findSelectedThreadIndex(
    { id: 'chat', name: 'Chat', threads },
    controller.state.selectedSessionPath,
    controller.state.selectedThreadId,
  )
  const nextThread = threads[getAdjacentIndex(index, threads.length, direction)]
  if (!nextThread?.sessionPath) return false
  controller.handleThreadOpen(nextThread.projectId, nextThread.id, nextThread.sessionPath, 'chat')
  return true
}

function selectAdjacentInboxThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.state.activeView !== 'inbox') return null
  const selectedPath = controller.state.selectedInboxSessionPath
  const currentIndex = selectedPath
    ? controller.inboxThreads.findIndex((thread) => thread.sessionPath === selectedPath)
    : 0
  if (controller.inboxThreads.length === 0) return false
  const nextIndex = getAdjacentIndex(currentIndex, controller.inboxThreads.length, direction)
  const nextThread = controller.inboxThreads[nextIndex]
  if (!nextThread) return false
  controller.handleSelectInboxThread(nextThread)
  return true
}

function handleProjectCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  if (commandId === 'thread.previousInProject') {
    return (
      selectAdjacentInboxThread(runtime, -1) ??
      openAdjacentChatThread(runtime, -1) ??
      openAdjacentThread(runtime, -1)
    )
  }
  if (commandId === 'thread.nextInProject') {
    return (
      selectAdjacentInboxThread(runtime, 1) ??
      openAdjacentChatThread(runtime, 1) ??
      openAdjacentThread(runtime, 1)
    )
  }
  return null
}

function handleRendererCommand(commandId: KeybindingCommandId) {
  if (!rendererCommandIds.has(commandId)) return false
  return dispatchHowcodeKeybindingCommand(commandId)
}

function handleSettingsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.state.activeView === 'settings') controller.handleCloseUtilityView()
  else controller.handleShowView('settings')
  return true
}

function handleGitOpsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  const { activeView, selectedSessionPath } = controller.state
  if (activeView === 'gitops') {
    controller.handleCloseGitOpsView()
    return true
  }
  if (activeView !== 'thread' || !selectedSessionPath) return false
  controller.handleOpenGitOpsView()
  return true
}

function runAppCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  const controller = runtime.appController
  const projectHandled = handleProjectCommand(commandId, runtime)
  if (projectHandled !== null) return projectHandled
  if (commandId === 'settings.open') return handleSettingsCommand(runtime)
  if (commandId === 'sidebar.toggle') runtime.onToggleSidebar()
  else if (commandId === 'terminal.toggle') controller.handleToggleTerminal()
  else if (commandId === 'gitops.open') return handleGitOpsCommand(runtime)
  else if (commandId === 'thread.new') {
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
    !commandCanRunFromEditableTarget(commandId, event, runtime)
  ) {
    return
  }
  const handled = runAppCommand(commandId, runtime)
  if (!handled) return
  event.preventDefault()
  event.stopImmediatePropagation()
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
