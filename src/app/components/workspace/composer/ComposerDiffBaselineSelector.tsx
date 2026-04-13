import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { desktopQueryKeys, listProjectCommitsQuery } from "../../../query/desktop-query";
import {
  compactCardClass,
  popoverPanelClass,
  settingsInputClass,
  toolbarButtonClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";
import { getDiffBaselineLabel } from "./diff-baseline";
import { formatGitCount } from "./git-ops";

type ComposerDiffBaselineSelectorProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>;
  projectId: string;
  projectGitState: ProjectGitState | null;
  selectedBaseline: ProjectDiffBaseline;
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void;
};

function matchesCommitSearch(commit: ProjectCommitEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }

  return [commit.subject, commit.sha, commit.shortSha, commit.authorName, commit.authorEmail].some(
    (value) => value.toLowerCase().includes(normalizedQuery),
  );
}

function CommitOption({
  commit,
  selected,
  onSelect,
}: {
  commit: ProjectCommitEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-11 w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
        selected && "bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]",
      )}
      onClick={onSelect}
      title={`${commit.subject || "(no subject)"} · ${commit.shortSha}`}
    >
      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
        {selected ? <Check size={14} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] text-[color:var(--text)]">
          {commit.subject || "(no subject)"}
        </span>
        <span className="block truncate text-[11px] text-[color:var(--muted)]">
          {commit.shortSha} · {commit.authorName}
        </span>
      </span>
    </button>
  );
}

export function ComposerDiffBaselineSelector({
  composerPanelRef,
  projectId,
  projectGitState,
  selectedBaseline,
  onSelectBaseline,
}: ComposerDiffBaselineSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionReady, setPositionReady] = useState(false);
  const panelId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({ right: 20, bottom: 20 });

  const commitsQuery = useQuery<ProjectCommitEntry[]>({
    queryKey: desktopQueryKeys.projectCommits(projectId, 100),
    queryFn: () => listProjectCommitsQuery(projectId, 100),
    enabled: open && projectId.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const commits = commitsQuery.data ?? [];
  const baselineLabel = useMemo(
    () => getDiffBaselineLabel(selectedBaseline, commits),
    [commits, selectedBaseline],
  );

  const visibleCommits = useMemo(() => {
    const nextCommits = searchQuery.trim().length
      ? commits.filter((commit) => matchesCommitSearch(commit, searchQuery))
      : commits;

    return nextCommits.slice(0, 10);
  }, [commits, searchQuery]);

  useDismissibleLayer({
    open,
    onDismiss: () => setOpen(false),
    refs: [anchorRef, panelRef],
  });

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPositionReady(false);
      return;
    }

    const updatePosition = () => {
      const composerRect = composerPanelRef.current?.getBoundingClientRect();
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      if (!composerRect || !anchorRect) {
        return;
      }

      setPanelPosition({
        right: Math.max(window.innerWidth - composerRect.right, 20),
        bottom: Math.max(window.innerHeight - anchorRect.top + 8, 20),
      });
      setPositionReady(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [composerPanelRef, open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          compactCardClass,
          "group relative inline-flex min-w-[9.5rem] items-center justify-end overflow-hidden px-2.5 py-1.5 text-right text-[12px] text-[color:var(--muted)]",
          open && "bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={cn(
            "flex items-center gap-2 transition-opacity duration-150 ease-out",
            open ? "opacity-0" : "group-hover:opacity-0",
          )}
        >
          <span className="text-[color:var(--muted)]">
            {formatGitCount(projectGitState?.fileCount ?? 0)} files
          </span>
          <span
            className={
              (projectGitState?.insertions ?? 0) > 0
                ? "text-[#7ee0bb]"
                : "text-[color:var(--muted)]"
            }
          >
            +{formatGitCount(projectGitState?.insertions ?? 0)}
          </span>
          <span
            className={
              (projectGitState?.deletions ?? 0) > 0 ? "text-[#ff9c9c]" : "text-[color:var(--muted)]"
            }
          >
            -{formatGitCount(projectGitState?.deletions ?? 0)}
          </span>
        </span>
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-end truncate px-2.5 text-[11px] uppercase tracking-[0.08em] text-[color:var(--text)] transition-opacity duration-150 ease-out",
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          Since {baselineLabel}
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <SurfacePanel
              id={panelId}
              ref={panelRef}
              aria-label="Diff baseline selector"
              className={cn(
                popoverPanelClass,
                "motion-popover fixed z-[120] grid w-[min(28rem,calc(100vw-2rem))] origin-bottom-right gap-2 rounded-2xl p-2 transition-[opacity,transform] duration-150 ease-out",
                positionReady
                  ? "opacity-100 translate-y-0"
                  : "pointer-events-none opacity-0 translate-y-1",
              )}
              style={{ right: `${panelPosition.right}px`, bottom: `${panelPosition.bottom}px` }}
            >
              <div className="px-2 pt-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Changes since
              </div>

              <button
                type="button"
                className={cn(
                  toolbarButtonClass,
                  "w-full justify-between rounded-xl px-2.5 py-2 text-[13px]",
                  selectedBaseline.kind === "before-today" &&
                    "bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]",
                )}
                onClick={() => {
                  onSelectBaseline({ kind: "before-today" });
                  setOpen(false);
                }}
              >
                <span>today</span>
                {selectedBaseline.kind === "before-today" ? <Check size={14} /> : null}
              </button>

              <button
                type="button"
                className={cn(
                  toolbarButtonClass,
                  "w-full justify-between rounded-xl px-2.5 py-2 text-[13px]",
                  selectedBaseline.kind === "main-branch" &&
                    "bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]",
                )}
                onClick={() => {
                  onSelectBaseline({ kind: "main-branch" });
                  setOpen(false);
                }}
              >
                <span>main branch</span>
                {selectedBaseline.kind === "main-branch" ? <Check size={14} /> : null}
              </button>

              <button
                type="button"
                className={cn(
                  toolbarButtonClass,
                  "w-full justify-between rounded-xl px-2.5 py-2 text-[13px]",
                  selectedBaseline.kind === "head" &&
                    "bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]",
                )}
                onClick={() => {
                  onSelectBaseline({ kind: "head" });
                  setOpen(false);
                }}
              >
                <span>last commit</span>
                {selectedBaseline.kind === "head" ? <Check size={14} /> : null}
              </button>

              <label className="relative block">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
                />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search commits"
                  className={cn(settingsInputClass, "w-full pl-9")}
                />
              </label>

              <div className="grid max-h-64 gap-0.5 overflow-y-auto pb-0.5">
                {visibleCommits.length > 0 ? (
                  visibleCommits.map((commit) => (
                    <CommitOption
                      key={commit.sha}
                      commit={commit}
                      selected={
                        selectedBaseline.kind === "commit" && selectedBaseline.sha === commit.sha
                      }
                      onSelect={() => {
                        onSelectBaseline({ kind: "commit", sha: commit.sha });
                        setOpen(false);
                      }}
                    />
                  ))
                ) : (
                  <div className="px-2.5 py-3 text-[12px] text-[color:var(--muted)]">
                    {commitsQuery.isLoading ? "Loading commits…" : "No commits found."}
                  </div>
                )}
              </div>
            </SurfacePanel>,
            document.body,
          )
        : null}
    </>
  );
}
