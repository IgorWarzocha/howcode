import { ChevronRight, FileText, FolderClosed, FolderOpen } from "lucide-react";
import { type ReactNode, memo, useCallback, useEffect, useMemo, useState } from "react";
import type { TurnDiffFile } from "../../../desktop/types";
import { cn } from "../../../utils/cn";
import { type TurnDiffTreeNode, buildTurnDiffTree } from "./turn-diff-tree";

export const ChangedFilesTree = memo(function ChangedFilesTree(props: {
  checkpointTurnCount: number;
  files: ReadonlyArray<TurnDiffFile>;
  allDirectoriesExpanded: boolean;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
}) {
  const { files, allDirectoriesExpanded, checkpointTurnCount, onOpenTurnDiff } = props;
  const treeNodes = useMemo(() => buildTurnDiffTree(files), [files]);
  const directoryPathsKey = useMemo(
    () => collectDirectoryPaths(treeNodes).join("\u0000"),
    [treeNodes],
  );
  const allDirectoryExpansionState = useMemo(
    () =>
      buildDirectoryExpansionState(
        directoryPathsKey ? directoryPathsKey.split("\u0000") : [],
        allDirectoriesExpanded,
      ),
    [allDirectoriesExpanded, directoryPathsKey],
  );
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>(() =>
    buildDirectoryExpansionState(directoryPathsKey ? directoryPathsKey.split("\u0000") : [], true),
  );

  useEffect(() => {
    setExpandedDirectories(allDirectoryExpansionState);
  }, [allDirectoryExpansionState]);

  const toggleDirectory = useCallback((pathValue: string, fallbackExpanded: boolean) => {
    setExpandedDirectories((current) => ({
      ...current,
      [pathValue]: !(current[pathValue] ?? fallbackExpanded),
    }));
  }, []);

  const renderTreeNode = (node: TurnDiffTreeNode, depth: number): ReactNode => {
    const leftPadding = 8 + depth * 14;
    if (node.kind === "directory") {
      const isExpanded = expandedDirectories[node.path] ?? depth === 0;
      return (
        <div key={`dir:${node.path}`}>
          <button
            type="button"
            className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-[rgba(255,255,255,0.04)]"
            style={{ paddingLeft: `${leftPadding}px` }}
            onClick={() => toggleDirectory(node.path, depth === 0)}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-[color:var(--muted)] transition-transform group-hover:text-[color:var(--text)]",
                isExpanded && "rotate-90",
              )}
            />
            {isExpanded ? (
              <FolderOpen className="size-3.5 shrink-0 text-[color:var(--muted)]" />
            ) : (
              <FolderClosed className="size-3.5 shrink-0 text-[color:var(--muted)]" />
            )}
            <span className="truncate font-mono text-[11px] text-[color:var(--muted)] group-hover:text-[color:var(--text)]">
              {node.name}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-[color:var(--muted)]">
              +{node.stat.additions} -{node.stat.deletions}
            </span>
          </button>
          {isExpanded ? (
            <div className="space-y-0.5">
              {node.children.map((childNode) => renderTreeNode(childNode, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <button
        key={`file:${node.path}`}
        type="button"
        className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-[rgba(255,255,255,0.04)]"
        style={{ paddingLeft: `${leftPadding}px` }}
        onClick={() => onOpenTurnDiff(checkpointTurnCount, node.path)}
      >
        <span aria-hidden="true" className="size-3.5 shrink-0" />
        <FileText className="size-3.5 shrink-0 text-[color:var(--muted)]" />
        <span className="truncate font-mono text-[11px] text-[color:var(--muted)] group-hover:text-[color:var(--text)]">
          {node.name}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-[color:var(--muted)]">
          +{node.stat.additions} -{node.stat.deletions}
        </span>
      </button>
    );
  };

  return <div className="space-y-0.5">{treeNodes.map((node) => renderTreeNode(node, 0))}</div>;
});

function collectDirectoryPaths(nodes: ReadonlyArray<TurnDiffTreeNode>): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.kind !== "directory") continue;
    paths.push(node.path);
    paths.push(...collectDirectoryPaths(node.children));
  }
  return paths;
}

function buildDirectoryExpansionState(
  directoryPaths: ReadonlyArray<string>,
  expanded: boolean,
): Record<string, boolean> {
  const expandedState: Record<string, boolean> = {};
  for (const directoryPath of directoryPaths) {
    expandedState[directoryPath] = expanded;
  }
  return expandedState;
}
