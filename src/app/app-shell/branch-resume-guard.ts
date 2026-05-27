import type {
  AnyDesktopActionPayload,
  DesktopActionInvoker,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
  Thread,
} from '../desktop/types'

type ShellProject = ShellState['projects'][number]

export type BranchResumeGuardCheck =
  | { shouldSwitch: false }
  | {
      currentBranch: string | null
      projectId: string
      shouldSwitch: true
      targetBranch: string
    }

function normalizeBranchName(branchName: string | null | undefined) {
  const normalized = branchName?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function findProject(projects: readonly ShellProject[], projectId: string | null | undefined) {
  if (!projectId) return null
  return projects.find((project) => project.id === projectId) ?? null
}

function findThreadBySessionPath(
  project: ShellProject | null,
  sessionPath: string | null | undefined,
) {
  if (!(project && sessionPath)) return null
  return project.threads.find((thread) => thread.sessionPath === sessionPath) ?? null
}

function getPayloadSessionPath(payload: AnyDesktopActionPayload) {
  return typeof payload.sessionPath === 'string' ? payload.sessionPath : null
}

function getPayloadProjectId(payload: AnyDesktopActionPayload) {
  return typeof payload.projectId === 'string' ? payload.projectId : null
}

function getTargetThreadBranch(thread: Thread | null, payload: AnyDesktopActionPayload) {
  return normalizeBranchName(
    typeof payload.branchName === 'string' ? payload.branchName : thread?.branchName,
  )
}

export function getBranchResumeGuardCheck(input: {
  gitState: ProjectGitState | null
  payload: AnyDesktopActionPayload
  shellState: ShellState | null
}): BranchResumeGuardCheck {
  const projectId = getPayloadProjectId(input.payload)
  const project = findProject(input.shellState?.projects ?? [], projectId)
  if (!project || project.worktree?.isMain === false) return { shouldSwitch: false }

  const thread = findThreadBySessionPath(project, getPayloadSessionPath(input.payload))
  const targetBranch = getTargetThreadBranch(thread, input.payload)
  if (!targetBranch) return { shouldSwitch: false }

  const currentBranch = normalizeBranchName(input.gitState?.branch)
  if (currentBranch === targetBranch) return { shouldSwitch: false }

  return {
    currentBranch,
    projectId: project.id,
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
  action: 'composer.send' | 'thread.open'
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
  action: 'composer.send' | 'thread.open'
  invokeDesktopAction: DesktopActionInvoker
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  payload: AnyDesktopActionPayload
  shellState: ShellState | null
}): Promise<DesktopActionResult | null> {
  const projectId = getPayloadProjectId(input.payload)
  if (!projectId) return null

  const gitState = await input.loadProjectGitState(projectId)
  const guard = getBranchResumeGuardCheck({
    gitState,
    payload: input.payload,
    shellState: input.shellState,
  })
  if (!guard.shouldSwitch) return null

  const switchResult = await input.invokeDesktopAction('workspace.switch-branch', {
    projectId: guard.projectId,
    value: guard.targetBranch,
  })
  if (!switchResult?.result?.error && switchResult?.ok !== false) return null

  return createBlockedBranchResumeResult({
    action: input.action,
    currentBranch: guard.currentBranch,
    payload: input.payload,
    targetBranch: guard.targetBranch,
  })
}
