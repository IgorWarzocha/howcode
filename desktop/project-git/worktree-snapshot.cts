import { runGitWithOptions, withTemporaryIndex } from "./git-runner.cts";

export const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export type WorktreeSnapshot = {
  fileCount: number;
  insertions: number;
  deletions: number;
  diffStat: string;
  nameStatus: string;
  numStat: string;
  patch: string;
};

export type WorktreeStats = Omit<WorktreeSnapshot, "patch">;

function parseNumStat(output: string) {
  let fileCount = 0;
  let insertions = 0;
  let deletions = 0;

  for (const line of output.split("\n")) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }

    fileCount += 1;

    const [rawInsertions, rawDeletions] = trimmedLine.split("\t");
    const parsedInsertions = Number.parseInt(rawInsertions ?? "", 10);
    const parsedDeletions = Number.parseInt(rawDeletions ?? "", 10);

    if (!Number.isNaN(parsedInsertions)) {
      insertions += parsedInsertions;
    }

    if (!Number.isNaN(parsedDeletions)) {
      deletions += parsedDeletions;
    }
  }

  return { fileCount, insertions, deletions };
}

async function withStagedWorktree<T>(
  projectId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean; treeOid: string }) => Promise<T>,
) {
  return withTemporaryIndex(projectId, async ({ env, hasHead }) => {
    await runGitWithOptions(projectId, ["add", "-A", "--", "."], {
      env,
      timeout: 20_000,
      maxBuffer: 1024 * 1024 * 8,
    });

    const { stdout } = await runGitWithOptions(projectId, ["write-tree"], {
      env,
      timeout: 20_000,
      maxBuffer: 1024 * 128,
    });

    const treeOid = stdout.trim() || (hasHead ? "HEAD^{tree}" : EMPTY_TREE_OID);
    return callback({ env, hasHead, treeOid });
  });
}

export async function captureWorktreeTree(projectId: string): Promise<string> {
  return withStagedWorktree(projectId, async ({ treeOid }) => treeOid);
}

export async function loadWorktreeSnapshot(
  projectId: string,
  options: { baselineRev?: string | null } = {},
): Promise<WorktreeSnapshot> {
  return withStagedWorktree(projectId, async ({ env, hasHead }) => {
    const baselineRev = options.baselineRev?.trim() || (hasHead ? "HEAD" : EMPTY_TREE_OID);
    const diffArguments = (extraArgs: string[]) => [
      "diff",
      "--cached",
      ...extraArgs,
      baselineRev,
      "--",
    ];

    const patchPromise = runGitWithOptions(
      projectId,
      diffArguments(["--unified=1", "--no-color", "--no-ext-diff", "--find-renames"]),
      {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 24,
      },
    ).then(({ stdout }) => stdout.trim());

    const statsPromise = loadWorktreeStats(projectId, { baselineRev, env, hasHead }).catch(() => ({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
      diffStat: "",
      nameStatus: "",
      numStat: "",
    }));

    const [stats, patchOutput] = await Promise.all([statsPromise, patchPromise]);

    return {
      ...stats,
      patch: patchOutput,
    };
  });
}

export async function loadWorktreeStats(
  projectId: string,
  options: {
    baselineRev?: string | null;
    env?: NodeJS.ProcessEnv;
    hasHead?: boolean;
  } = {},
): Promise<WorktreeStats> {
  const loadStats = async (context?: { env?: NodeJS.ProcessEnv; hasHead?: boolean }) => {
    const hasHead = context?.hasHead ?? false;
    const baselineRev =
      context?.hasHead === false
        ? options.baselineRev?.trim() || EMPTY_TREE_OID
        : options.baselineRev?.trim() || (hasHead ? "HEAD" : EMPTY_TREE_OID);
    const diffArguments = (extraArgs: string[]) => [
      "diff",
      "--cached",
      ...extraArgs,
      baselineRev,
      "--",
    ];

    const numStatOutput = await runGitWithOptions(
      projectId,
      diffArguments(["--numstat", "--find-renames"]),
      {
        env: context?.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    ).then(
      ({ stdout }) => stdout.trim(),
      () => "",
    );

    const numStat = parseNumStat(numStatOutput);

    return {
      fileCount: numStat.fileCount,
      insertions: numStat.insertions,
      deletions: numStat.deletions,
      diffStat: "",
      nameStatus: "",
      numStat: numStatOutput,
    };
  };

  if (options.env) {
    return loadStats({ env: options.env, hasHead: options.hasHead ?? false });
  }

  return withTemporaryIndex(projectId, async ({ env, hasHead }) => {
    await runGitWithOptions(projectId, ["add", "-A", "--", "."], {
      env,
      timeout: 20_000,
      maxBuffer: 1024 * 1024 * 8,
    });

    return loadStats({ env, hasHead });
  });
}
