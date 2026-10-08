export type GitMetadataPeers = {
  setDirectoryGitOpsMode: (directoryId: string, mode: 'commit' | 'commit-push' | null) => unknown
  setDirectoryRepoOrigin: (directoryId: string, origin: string | null) => unknown
}
