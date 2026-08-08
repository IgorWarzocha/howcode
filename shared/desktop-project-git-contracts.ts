import type { GitOpsMode } from './desktop-settings-contracts'

export type ProjectDiffRenderMode = 'stacked' | 'split'
export type ProjectDiffDefaultBaseline =
  | { kind: 'head' }
  | { kind: 'previous' }
  | { kind: 'main-branch' }
  | { kind: 'dev-branch' }

export type ProjectGitState = {
  projectId: string
  isGitRepo: boolean
  branch: string | null
  branches: string[]
  defaultBranchName: string | null
  devBranchName: string | null
  mainBranchName: string | null
  fileCount: number
  stagedFileCount: number
  unstagedFileCount: number
  untrackedFileCount: number
  insertions: number
  deletions: number
  hasOrigin: boolean
  originName: string | null
  originUrl: string | null
  gitOpsModeOverride: GitOpsMode | null
  worktrees: ProjectGitWorktreeEntry[]
}

export type ProjectGitWorktreeEntry = {
  path: string
  branch: string | null
  head: string | null
  detached: boolean
}

export type ProjectDiffBaseline =
  | { kind: 'head' }
  | { kind: 'previous' }
  | { kind: 'last-opened'; rev: string; capturedAt?: string | undefined | null | undefined }
  | { kind: 'main-branch' }
  | { kind: 'dev-branch' }
  | { kind: 'parent-branch'; branchName: string }
  | { kind: 'branch'; branchName: string }
  | { kind: 'commit'; sha: string }

export type ProjectDiffPreferences = {
  baseline: ProjectDiffBaseline | null
  renderMode: ProjectDiffRenderMode | null
}

export type ProjectDiffResolvedBaseline = {
  kind: ProjectDiffBaseline['kind']
  rev: string
  label: string
  commitSha: string | null
  shortSha: string | null
  subject: string | null
  committedAt: string | null
  capturedAt: string | null
}

export type ProjectCommitEntry = {
  sha: string
  shortSha: string
  subject: string
  authorName: string
  authorEmail: string
  authoredAt: string
  committedAt: string
  decorations: string[]
  isHead: boolean
}

export type ProjectDiffResult = {
  projectId: string
  diff: string
  fileCount: number
  insertions: number
  deletions: number
  baseline: ProjectDiffBaseline
  resolvedBaseline: ProjectDiffResolvedBaseline
}

export type ProjectDiffImageSide = 'old' | 'new'

export type ProjectDiffImagePreview = {
  side: ProjectDiffImageSide
  mimeType: string
  dataUrl: string
} | null

export type ProjectDiffFileContentsRequest = {
  projectId: string
  baselineRevision: string
  oldPath: string | null
  newPath: string
}

export type ProjectDiffTextFile = {
  path: string
  contents: string
  revision: string
}

export type ProjectDiffFileContentIssue = {
  kind: 'invalid-path' | 'missing' | 'not-file' | 'binary' | 'too-large' | 'changed'
  side: 'old' | 'new'
  path: string
  size?: number | undefined
  maxBytes?: number | undefined
}

export type ProjectDiffFileContentsResult =
  | {
      kind: 'ready'
      oldFile: ProjectDiffTextFile | null
      newFile: ProjectDiffTextFile
    }
  | {
      kind: 'unavailable'
      issue: ProjectDiffFileContentIssue
    }

export type ProjectDiffStatsResult = {
  projectId: string
  fileCount: number
  insertions: number
  deletions: number
  baseline: ProjectDiffBaseline
  resolvedBaseline: ProjectDiffResolvedBaseline
}

export type ProjectDiffStreamStartResult = {
  streamId: string
}

export type ProjectDiffStreamEvent =
  | {
      type: 'chunk'
      streamId: string
      projectId: string
      sequence: number
      chunk: string
    }
  | {
      type: 'complete'
      streamId: string
      projectId: string
      result: ProjectDiffResult | null
    }
  | {
      type: 'error'
      streamId: string
      projectId: string
      error: string
    }
