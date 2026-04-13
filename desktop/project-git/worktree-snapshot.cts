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

function parseShortStat(output: string) {
  const insertionsMatch = output.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = output.match(/(\d+)\s+deletions?\(-\)/);

  return {
    insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) : 0,
    deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) : 0,
  };
}

function countNonEmptyLines(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
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

    const [shortStatOutput, diffStatOutput, nameStatusOutput, numStatOutput] = await Promise.all([
      runGitWithOptions(projectId, diffArguments(["--shortstat"]), {
        env: context?.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(["--stat=200,200", "--find-renames"]), {
        env: context?.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(["--name-status", "--find-renames"]), {
        env: context?.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(["--numstat", "--find-renames"]), {
        env: context?.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
    ]);

    const shortStat = parseShortStat(shortStatOutput);

    return {
      fileCount: Math.max(countNonEmptyLines(nameStatusOutput), countNonEmptyLines(numStatOutput)),
      insertions: shortStat.insertions,
      deletions: shortStat.deletions,
      diffStat: diffStatOutput,
      nameStatus: nameStatusOutput,
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
