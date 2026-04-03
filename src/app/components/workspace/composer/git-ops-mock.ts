export type GitOpsMockMode = "dirty" | "clean" | "not-git";

export const gitOpsMockModes: GitOpsMockMode[] = ["dirty", "clean", "not-git"];

export const gitOpsMockMeta: Record<
  GitOpsMockMode,
  {
    branch: string | null;
    files: number;
    additions: number;
    deletions: number;
    title: string;
    description: string;
  }
> = {
  dirty: {
    branch: "master",
    files: 49,
    additions: 1541,
    deletions: 348,
    title: "Current workspace changes",
    description:
      "Review changes since the last commit, include unstaged edits by default, then commit or open the diff.",
  },
  clean: {
    branch: "master",
    files: 0,
    additions: 0,
    deletions: 0,
    title: "Working tree is clean",
    description:
      "No local changes right now. This surface can still expose commit history and branch-aware actions later.",
  },
  "not-git": {
    branch: null,
    files: 0,
    additions: 0,
    deletions: 0,
    title: "Git repository required",
    description:
      "When this project is not a git repository, the composer entrypoint should turn red and invite the user to initialize git.",
  },
};

export function formatGitCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function getGitOpsEntryButtonClass(mode: GitOpsMockMode) {
  if (mode === "not-git") {
    return "border-[rgba(255,110,110,0.22)] text-[#ff9c9c] hover:border-[rgba(255,110,110,0.36)] hover:bg-[rgba(255,94,94,0.08)] hover:text-[#ffd1d1]";
  }

  if (mode === "dirty") {
    return "border-[rgba(92,201,165,0.22)] text-[#7ee0bb] hover:border-[rgba(92,201,165,0.34)] hover:bg-[rgba(92,201,165,0.08)] hover:text-[#bdf7dd]";
  }

  return "border-[rgba(169,178,215,0.16)] text-[color:var(--muted)] hover:border-[rgba(169,178,215,0.26)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";
}

export function getGitOpsModeLabel(mode: GitOpsMockMode) {
  switch (mode) {
    case "dirty":
      return "Changes";
    case "clean":
      return "Clean";
    case "not-git":
      return "Not git";
  }
}
