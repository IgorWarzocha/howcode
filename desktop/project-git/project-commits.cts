import type { ProjectCommitEntry } from "../../shared/desktop-contracts.ts";
import { runGitWithOptions } from "./git-runner.cts";
import { isGitRepository } from "./project-state.cts";

const FIELD_SEPARATOR = "\u001f";
const RECORD_SEPARATOR = "\u001e";
const COMMIT_PRETTY_FORMAT = ["%H", "%h", "%an", "%ae", "%aI", "%cI", "%D", "%s"].join(
  `%x${FIELD_SEPARATOR.charCodeAt(0).toString(16)}`,
);

function parseDecorations(rawDecorations: string) {
  return rawDecorations
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseCommitEntry(record: string): ProjectCommitEntry | null {
  const [sha, shortSha, authorName, authorEmail, authoredAt, committedAt, rawDecorations, subject] =
    record.split(FIELD_SEPARATOR);

  if (!sha || !shortSha || !subject) {
    return null;
  }

  const decorations = parseDecorations(rawDecorations ?? "");

  return {
    sha,
    shortSha,
    subject,
    authorName: authorName ?? "",
    authorEmail: authorEmail ?? "",
    authoredAt: authoredAt ?? "",
    committedAt: committedAt ?? "",
    decorations,
    isHead: decorations.some((entry) => entry === "HEAD" || entry.startsWith("HEAD -> ")),
  };
}

export async function resolveCommitRevision(
  projectId: string,
  rev: string,
): Promise<string | null> {
  try {
    const { stdout } = await runGitWithOptions(
      projectId,
      ["rev-parse", "--verify", `${rev}^{commit}`],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      },
    );

    const resolvedRev = stdout.trim();
    return resolvedRev.length > 0 ? resolvedRev : null;
  } catch {
    return null;
  }
}

export async function getProjectCommitEntry(
  projectId: string,
  rev: string,
): Promise<ProjectCommitEntry | null> {
  const resolvedRev = await resolveCommitRevision(projectId, rev);
  if (!resolvedRev) {
    return null;
  }

  const { stdout } = await runGitWithOptions(
    projectId,
    ["show", "--no-patch", "--decorate=short", `--format=${COMMIT_PRETTY_FORMAT}`, resolvedRev],
    {
      timeout: 10_000,
      maxBuffer: 1024 * 512,
    },
  );

  return parseCommitEntry(stdout.trim());
}

export async function listProjectCommits(
  projectId: string,
  limit?: number | null,
): Promise<ProjectCommitEntry[]> {
  if (!(await isGitRepository(projectId))) {
    return [];
  }

  const normalizedLimit = Math.min(Math.max(limit ?? 50, 1), 200);

  let stdout = "";

  try {
    ({ stdout } = await runGitWithOptions(
      projectId,
      [
        "log",
        `--max-count=${normalizedLimit}`,
        "--decorate=short",
        `--format=${COMMIT_PRETTY_FORMAT}%x${RECORD_SEPARATOR.charCodeAt(0).toString(16)}`,
      ],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    ));
  } catch {
    return [];
  }

  return stdout
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => parseCommitEntry(record))
    .filter((record): record is ProjectCommitEntry => record !== null);
}
