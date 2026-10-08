import type {
  AnyDesktopActionPayload,
  Chat,
  DesktopActionInvoker,
  DesktopActionResult,
  DirectoryGitState,
  ShellState,
} from '../desktop/types'

type ShellDirectory = ShellState['directories'][number]

export type BranchResumeGuardCheck =
  | { shouldSwitch: false }
  | {
      currentBranch: string | null
      directoryId: string
      shouldSwitch: true
      targetBranch: string
    }

function normalizeBranchName(branchName: string | null | undefined) {
  const normalized = branchName?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function findDirectory(
  directories: readonly ShellDirectory[],
  directoryId: string | null | undefined,
) {
  if (!directoryId) return null
  return directories.find((directory) => directory.id === directoryId) ?? null
}

function findChatByConversationId(
  directory: ShellDirectory | null,
  conversationId: string | null | undefined,
) {
  if (!(directory && conversationId)) return null
  return directory.chats.find((chat) => chat.conversationId === conversationId) ?? null
}

function getPayloadConversationId(payload: AnyDesktopActionPayload) {
  return typeof payload.conversationId === 'string' ? payload.conversationId : null
}

function getPayloadDirectoryId(payload: AnyDesktopActionPayload) {
  return typeof payload.directoryId === 'string' ? payload.directoryId : null
}

function getTargetChatBranch(chat: Chat | null, payload: AnyDesktopActionPayload) {
  return normalizeBranchName(
    typeof payload.branchName === 'string' ? payload.branchName : chat?.branchName,
  )
}

export function getBranchResumeGuardCheck(input: {
  gitState: DirectoryGitState | null
  payload: AnyDesktopActionPayload
  shellState: ShellState | null
}): BranchResumeGuardCheck {
  const directoryId = getPayloadDirectoryId(input.payload)
  const directory = findDirectory(input.shellState?.directories ?? [], directoryId)
  if (!directory || directory.worktree?.isMain === false) return { shouldSwitch: false }

  const chat = findChatByConversationId(directory, getPayloadConversationId(input.payload))
  const targetBranch = getTargetChatBranch(chat, input.payload)
  if (!targetBranch) return { shouldSwitch: false }

  const currentBranch = normalizeBranchName(input.gitState?.branch)
  if (currentBranch === targetBranch) return { shouldSwitch: false }

  return {
    currentBranch,
    directoryId: directory.id,
    shouldSwitch: true,
    targetBranch,
  }
}

function formatBranchResumeGuardError(input: {
  currentBranch: string | null
  targetBranch: string
}) {
  const currentBranch = input.currentBranch ?? 'the current branch'
  return `${currentBranch} has uncommitted changes. Commit them first, then resend your prompt.`
}

export function createBlockedBranchResumeResult(input: {
  action: 'composer.send' | 'chat.open'
  currentBranch: string | null
  payload: AnyDesktopActionPayload
  targetBranch: string
}): DesktopActionResult {
  return {
    ok: false,
    at: new Date().toISOString(),
    payload: {
      action: input.action,
      payload: input.payload,
    },
    result: {
      error: formatBranchResumeGuardError(input),
    },
  }
}

export async function guardBranchResume(input: {
  action: 'composer.send' | 'chat.open'
  invokeDesktopAction: DesktopActionInvoker
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  payload: AnyDesktopActionPayload
  shellState: ShellState | null
  onSwitchBranchSuccess?: (payload: AnyDesktopActionPayload) => Promise<void> | void
}): Promise<DesktopActionResult | null> {
  const directoryId = getPayloadDirectoryId(input.payload)
  if (!directoryId) return null

  const gitState = await input.loadDirectoryGitState(directoryId)
  const guard = getBranchResumeGuardCheck({
    gitState,
    payload: input.payload,
    shellState: input.shellState,
  })
  if (!guard.shouldSwitch) return null

  const switchPayload = {
    directoryId: guard.directoryId,
    value: guard.targetBranch,
  }
  const switchResult = await input.invokeDesktopAction('git.switch-branch', switchPayload)
  if (!switchResult?.result?.error && switchResult?.ok !== false) {
    await input.onSwitchBranchSuccess?.(switchPayload)
    return null
  }

  return createBlockedBranchResumeResult({
    action: input.action,
    currentBranch: guard.currentBranch,
    payload: input.payload,
    targetBranch: guard.targetBranch,
  })
}
