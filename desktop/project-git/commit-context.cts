import type { ProjectDiffResult } from "../../shared/desktop-contracts.ts";
import { hasHeadCommit, runGitWithOptions, withTemporaryIndex } from "./git-runner.cts";
import { getBranch, getOriginUrl, isGitRepository } from "./project-state.cts";
import type { CommitMessageContext } from "./types.cts";

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

export function buildDefaultCommitMessage(context: { fileCount: number }) {
  if (context.fileCount <= 0) {
    return "Update workspace";
  }

  return context.fileCount === 1 ? "Update 1 file" : `Update ${context.fileCount} files`;
}

export async function prepareCommitMessageContext(
  projectId: string,
  includeUnstaged: boolean,
): Promise<CommitMessageContext | null> {
  if (!(await isGitRepository(projectId))) {
    return null;
  }

  const diffArguments = (hasHead: boolean, extraArgs: string[]) => [
    "diff",
    "--cached",
    ...(hasHead ? [] : ["--root"]),
    ...extraArgs,
    "--",
  ];

  const loadContextOutputs = async (options?: { env?: NodeJS.ProcessEnv; hasHead?: boolean }) => {
    const hasHead = options?.hasHead ?? (await hasHeadCommit(projectId));

    const [
      branch,
      originUrl,
      shortStatOutput,
      diffStatOutput,
      nameStatusOutput,
      numStatOutput,
      patchOutput,
    ] = await Promise.all([
      getBranch(projectId),
      getOriginUrl(projectId),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--shortstat"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--stat=200,200", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--name-status", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--numstat", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(
        projectId,
        diffArguments(hasHead, ["--unified=1", "--no-color", "--no-ext-diff", "--find-renames"]),
        {
          env: options?.env,
          timeout: 10_000,
          maxBuffer: 1024 * 1024 * 12,
        },
      ).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
    ]);

    return {
      branch,
      originUrl,
      shortStatOutput,
      diffStatOutput,
      nameStatusOutput,
      numStatOutput,
      patchOutput,
    };
  };

  const outputs = includeUnstaged
    ? await withTemporaryIndex(projectId, async ({ env, hasHead }) => {
        await runGitWithOptions(projectId, ["add", "-A", "--", "."], {
          env,
          timeout: 10_000,
          maxBuffer: 1024 * 1024 * 4,
        });
        return loadContextOutputs({ env, hasHead });
      })
    : await loadContextOutputs();

  const {
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  } = outputs;

  const shortStat = parseShortStat(shortStatOutput);
  const fileCount = Math.max(
    countNonEmptyLines(nameStatusOutput),
    countNonEmptyLines(numStatOutput),
  );

  if (fileCount <= 0) {
    return null;
  }

  return {
    projectId,
    branch,
    hasOrigin: originUrl !== null,
    includeUnstaged,
    fileCount,
    insertions: shortStat.insertions,
    deletions: shortStat.deletions,
    nameStatus: nameStatusOutput,
    diffStat: diffStatOutput,
    numStat: numStatOutput,
    patch: patchOutput,
  };
}

export async function loadProjectDiff(projectId: string): Promise<ProjectDiffResult | null> {
  const context = await prepareCommitMessageContext(projectId, true);
  if (!context) {
    return null;
  }

  return {
    projectId,
    diff: context.patch,
  };
}
