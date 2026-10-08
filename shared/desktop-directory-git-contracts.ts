export type GitOpsMode = 'commit' | 'commit-push'
export type DirectoryDiffRenderMode = 'stacked' | 'split'
export type DirectoryDiffDefaultBaseline =
  | { kind: 'head' }
  | { kind: 'previous' }
  | { kind: 'main-branch' }
  | { kind: 'dev-branch' }

export type DirectoryGitState = {
  directoryId: string
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
  worktrees: DirectoryGitWorktreeEntry[]
}

export type DirectoryGitWorktreeEntry = {
  path: string
  branch: string | null
  head: string | null
  detached: boolean
}

export type DirectoryDiffBaseline =
  | { kind: 'head' }
  | { kind: 'previous' }
  | { kind: 'last-opened'; rev: string; capturedAt?: string | undefined | null | undefined }
  | { kind: 'main-branch' }
  | { kind: 'dev-branch' }
  | { kind: 'parent-branch'; branchName: string }
  | { kind: 'branch'; branchName: string }
  | { kind: 'commit'; sha: string }

export type DirectoryDiffPreferences = {
  baseline: DirectoryDiffBaseline | null
  renderMode: DirectoryDiffRenderMode | null
}

export type DirectoryDiffResolvedBaseline = {
  kind: DirectoryDiffBaseline['kind']
  rev: string
  label: string
  commitSha: string | null
  shortSha: string | null
  subject: string | null
  committedAt: string | null
  capturedAt: string | null
}

export type DirectoryCommitEntry = {
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

export type DirectoryDiffResult = {
  directoryId: string
  diff: string
  fileCount: number
  insertions: number
  deletions: number
  baseline: DirectoryDiffBaseline
  resolvedBaseline: DirectoryDiffResolvedBaseline
}

export type DirectoryDiffImageSide = 'old' | 'new'

export type DirectoryDiffImagePreview = {
  side: DirectoryDiffImageSide
  mimeType: string
  dataUrl: string
} | null

export type DirectoryDiffFileContentsRequest = {
  directoryId: string
  baselineRevision: string
  oldPath: string | null
  newPath: string
}

export type DirectoryDiffTextFile = {
  path: string
  contents: string
  revision: string
}

export type DirectoryDiffFileContentIssue = {
  kind: 'invalid-path' | 'missing' | 'not-file' | 'binary' | 'too-large' | 'changed'
  side: 'old' | 'new'
  path: string
  size?: number | undefined
  maxBytes?: number | undefined
}

export type DirectoryDiffFileContentsResult =
  | {
      kind: 'ready'
      oldFile: DirectoryDiffTextFile | null
      newFile: DirectoryDiffTextFile
    }
  | {
      kind: 'unavailable'
      issue: DirectoryDiffFileContentIssue
    }

export type DirectoryFileWriteRequest = {
  directoryId: string
  path: string
  contents: string
  expectedRevision: string
}

export type DirectoryFileWriteResult =
  | {
      kind: 'written'
      file: DirectoryDiffTextFile
    }
  | {
      kind: 'conflict'
      path: string
      expectedRevision: string
      currentRevision: string | null
    }
  | {
      kind: 'unavailable'
      issue: DirectoryDiffFileContentIssue
    }

export type DirectoryDiffStatsResult = {
  directoryId: string
  fileCount: number
  insertions: number
  deletions: number
  baseline: DirectoryDiffBaseline
  resolvedBaseline: DirectoryDiffResolvedBaseline
}

export type DirectoryDiffStreamStartResult = {
  streamId: string
}

export type DirectoryDiffStreamEvent =
  | {
      type: 'chunk'
      streamId: string
      directoryId: string
      sequence: number
      chunk: string
    }
  | {
      type: 'complete'
      streamId: string
      directoryId: string
      result: DirectoryDiffResult | null
    }
  | {
      type: 'error'
      streamId: string
      directoryId: string
      error: string
    }
