import type { ProjectCommitEntry } from "../../shared/desktop-contracts.ts";
import { runGitWithOptions } from "./git-runner.cts";
import { isGitRepository } from "./project-state.cts";

const FIELD_SEPARATOR = "\0";
const COMMIT_FIELD_COUNT = 8;
const COMMIT_PRETTY_FORMAT = ["%H", "%h", "%an", "%ae", "%aI", "%cI", "%D", "%s", ""].join("%x00");

function parseDecorations(rawDecorations: string) {
  const value = rawDecorations.trim();
  return value.length > 0 ? [value] : [];
}

function parseCommitEntry(fields: string[]): ProjectCommitEntry | null {
  const [sha, shortSha, authorName, authorEmail, authoredAt, committedAt, rawDecorations, subject] =
    fields;

  if (!sha || !shortSha) {
    return null;
  }

  const decorations = parseDecorations(rawDecorations ?? "");

  return {
    sha,
    shortSha,
    subject: subject ?? "",
    authorName: authorName ?? "",
    authorEmail: authorEmail ?? "",
    authoredAt: authoredAt ?? "",
    committedAt: committedAt ?? "",
    decorations,
    isHead: /(^|,\s*)HEAD(?:\s*->\s*[^,]+)?(?:,|$)/.test(rawDecorations ?? ""),
  };
}

function parseCommitEntries(output: string) {
  return output
    .replace(/\n$/, "")
    .split(FIELD_SEPARATOR)
    .reduce<string[][]>((records, field, index) => {
      const recordIndex = Math.floor(index / COMMIT_FIELD_COUNT);
      const currentRecord = records[recordIndex] ?? [];
      currentRecord.push(field);
      records[recordIndex] = currentRecord;
      return records;
    }, [])
    .filter((fields) => fields.length >= COMMIT_FIELD_COUNT)
    .map((fields) => parseCommitEntry(fields.slice(0, COMMIT_FIELD_COUNT)))
    .filter((record): record is ProjectCommitEntry => record !== null);
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

  return parseCommitEntries(stdout)[0] ?? null;
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
        "-z",
        `--max-count=${normalizedLimit}`,
        "--decorate=short",
        `--format=${COMMIT_PRETTY_FORMAT}`,
      ],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    ));
  } catch {
    return [];
  }

  return parseCommitEntries(stdout);
}
