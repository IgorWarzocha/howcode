import { runGitWithOptions, withTemporaryIndex } from "./git-runner.cts";

export type WorktreeSnapshot = {
  fileCount: number;
  insertions: number;
  deletions: number;
  diffStat: string;
  nameStatus: string;
  numStat: string;
  patch: string;
};

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

export async function loadWorktreeSnapshot(projectId: string): Promise<WorktreeSnapshot> {
  return withTemporaryIndex(projectId, async ({ env, hasHead }) => {
    const diffArguments = (extraArgs: string[]) => [
      "diff",
      "--cached",
      ...(hasHead ? [] : ["--root"]),
      ...extraArgs,
      "--",
    ];

    await runGitWithOptions(projectId, ["add", "-A", "--", "."], {
      env,
      timeout: 20_000,
      maxBuffer: 1024 * 1024 * 8,
    });

    const [shortStatOutput, diffStatOutput, nameStatusOutput, numStatOutput, patchOutput] =
      await Promise.all([
        runGitWithOptions(projectId, diffArguments(["--shortstat"]), {
          env,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 4,
        }).then(({ stdout }) => stdout.trim()),
        runGitWithOptions(projectId, diffArguments(["--stat=200,200", "--find-renames"]), {
          env,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 4,
        }).then(({ stdout }) => stdout.trim()),
        runGitWithOptions(projectId, diffArguments(["--name-status", "--find-renames"]), {
          env,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 4,
        }).then(({ stdout }) => stdout.trim()),
        runGitWithOptions(projectId, diffArguments(["--numstat", "--find-renames"]), {
          env,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 4,
        }).then(({ stdout }) => stdout.trim()),
        runGitWithOptions(
          projectId,
          diffArguments(["--unified=1", "--no-color", "--no-ext-diff", "--find-renames"]),
          {
            env,
            timeout: 20_000,
            maxBuffer: 1024 * 1024 * 24,
          },
        ).then(({ stdout }) => stdout.trim()),
      ]);

    const shortStat = parseShortStat(shortStatOutput);

    return {
      fileCount: Math.max(countNonEmptyLines(nameStatusOutput), countNonEmptyLines(numStatOutput)),
      insertions: shortStat.insertions,
      deletions: shortStat.deletions,
      diffStat: diffStatOutput,
      nameStatus: nameStatusOutput,
      numStat: numStatOutput,
      patch: patchOutput,
    };
  });
}
