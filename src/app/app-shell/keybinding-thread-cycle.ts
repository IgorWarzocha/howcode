import type { Project, Thread } from '../types'
import type { KeybindingRuntime } from './keybinding-runtime'

function findSelectedThreadIndex(
  project: Project | null,
  selectedSessionPath: string | null,
  selectedThreadId: string | null,
) {
  if (!project) return -1
  const selectedThreadIndex = project.threads.findIndex(
    (thread) => selectedThreadId !== null && thread.id === selectedThreadId,
  )
  if (selectedThreadIndex >= 0) return selectedThreadIndex
  return project.threads.findIndex((thread) => {
    return Boolean(selectedSessionPath && thread.sessionPath === selectedSessionPath)
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

function openAdjacentThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (
    !(
      controller.workspace.state.activeView === 'thread' ||
      controller.workspace.state.activeView === 'project'
    )
  ) {
    return false
  }
  if (
    controller.workspace.state.activeView === 'project' &&
    !controller.workspace.state.selectedProjectId
  )
    return false
  const project =
    controller.projects.items.find(
      (item) =>
        item.id === (controller.workspace.state.selectedProjectId || controller.composer.projectId),
    ) ?? null
  const cycleSelection = runtime.cycleSelectionRef.current
  const hasThreadCycleSelection =
    cycleSelection !== null &&
    cycleSelection.projectId === project?.id &&
    cycleSelection.view === 'thread'
  const index = findSelectedThreadIndex(
    project,
    hasThreadCycleSelection
      ? cycleSelection.sessionPath
      : controller.workspace.state.selectedSessionPath,
    hasThreadCycleSelection ? cycleSelection.threadId : controller.workspace.state.selectedThreadId,
  )
  if (!(project && project.threads.length > 0)) return false
  const nextIndex = getAdjacentIndex(index, project.threads.length, direction)
  const nextThread = project.threads[nextIndex]
  if (!nextThread) return false
  runtime.cycleSelectionRef.current = {
    projectId: project.id,
    threadId: nextThread.id,
    sessionPath: getThreadSessionPath(nextThread),
    view: 'thread',
  }
  controller.thread.cycle(project.id, nextThread.id, getThreadSessionPath(nextThread), 'thread')
  return true
}

function getChatThreads(runtime: KeybindingRuntime) {
  const chatState = runtime.appController.chat.state
  if (!chatState) return []
  return [...chatState.ungroupedThreads, ...chatState.groups.flatMap((group) => group.threads)]
}

function openAdjacentChatThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView !== 'chat') return null
  const threads = getChatThreads(runtime)
  const cycleSelection = runtime.cycleSelectionRef.current
  const hasChatCycleSelection = cycleSelection !== null && cycleSelection.view === 'chat'
  const index = findSelectedThreadIndex(
    { id: 'chat', name: 'Chat', threads },
    hasChatCycleSelection
      ? cycleSelection.sessionPath
      : controller.workspace.state.selectedSessionPath,
    hasChatCycleSelection ? cycleSelection.threadId : controller.workspace.state.selectedThreadId,
  )
  const nextThread = threads[getAdjacentIndex(index, threads.length, direction)]
  if (!nextThread?.sessionPath) return false
  runtime.cycleSelectionRef.current = {
    projectId: nextThread.projectId,
    threadId: nextThread.id,
    sessionPath: nextThread.sessionPath,
    view: 'chat',
  }
  controller.thread.cycle(nextThread.projectId, nextThread.id, nextThread.sessionPath, 'chat')
  return true
}

function selectAdjacentInboxThread(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView !== 'inbox') return null
  const selectedPath = controller.workspace.state.selectedInboxSessionPath
  const currentIndex = selectedPath
    ? controller.inbox.threads.findIndex((thread) => thread.sessionPath === selectedPath)
    : 0
  if (controller.inbox.threads.length === 0) return false
  const nextIndex = getAdjacentIndex(currentIndex, controller.inbox.threads.length, direction)
  const nextThread = controller.inbox.threads[nextIndex]
  if (!nextThread) return false
  controller.inbox.select(nextThread)
  return true
}

export function handleThreadCycleCommand(runtime: KeybindingRuntime, direction: -1 | 1) {
  return (
    selectAdjacentInboxThread(runtime, direction) ??
    openAdjacentChatThread(runtime, direction) ??
    openAdjacentThread(runtime, direction)
  )
}
