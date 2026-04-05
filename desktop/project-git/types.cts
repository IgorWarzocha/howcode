export type CommitMessageContext = {
  projectId: string;
  branch: string | null;
  hasOrigin: boolean;
  includeUnstaged: boolean;
  fileCount: number;
  insertions: number;
  deletions: number;
  nameStatus: string;
  diffStat: string;
  numStat: string;
  patch: string;
};
