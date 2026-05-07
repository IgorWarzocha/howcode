import type { FileDiffMetadata } from '@pierre/diffs/react'
import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react'
import { FilterX, Search } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef } from 'react'
import { cn } from '../../../utils/cn'
import { getFileChangeCounts, resolveFileDiffPath } from './diff-panel-content.helpers'

const TREE_UNSAFE_CSS = `
  :host {
    color-scheme: dark;
    --trees-fg-override: var(--text);
    --trees-muted-fg-override: var(--muted);
    --trees-bg-override: var(--workspace);
    --trees-bg-muted-override: rgba(169, 178, 215, 0.075);
    --trees-border-color-override: rgba(169, 178, 215, 0.11);
    --trees-search-bg-override: rgba(10, 12, 18, 0.44);
    --trees-search-fg-override: var(--text);
    --trees-selected-bg-override: rgba(168, 177, 255, 0.16);
    --trees-selected-fg-override: var(--text);
    --trees-focused-bg-override: rgba(169, 178, 215, 0.08);
    --trees-hover-bg-override: rgba(169, 178, 215, 0.08);
    --trees-border-radius-override: 9px;
    --trees-padding-inline-override: 0px;
    --trees-level-gap-override: 0px;
    --trees-item-margin-x-override: 0px;
    --trees-item-padding-x-override: 0.625rem;
    --trees-scrollbar-thumb-override: rgba(169, 178, 215, 0.24);
    --trees-scrollbar-gutter-override: 6px;
    background: transparent;
    font-family: var(--font-sans, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif);
  }
  [data-file-tree-virtualized-list='true'],
  [data-file-tree-sticky-overlay-content='true'] {
    background: transparent;
  }
  button[data-type='item'] {
    border-radius: 10px;
    min-width: 0;
  }
  [data-row-decoration] {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
`

type DiffChangedFilesTreeProps = {
  files: FileDiffMetadata[]
  selectedPaths: readonly string[]
  focusedFileCount: number
  onSelectedPathsChange: (paths: readonly string[]) => void
}

function getGitStatus(file: FileDiffMetadata): GitStatusEntry['status'] {
  switch (file.type) {
    case 'new':
      return 'added'
    case 'deleted':
      return 'deleted'
    case 'rename-pure':
    case 'rename-changed':
      return 'renamed'
    default:
      return 'modified'
  }
}

const treeHostStyle = {
  '--trees-bg-override': 'var(--workspace)',
  '--trees-padding-inline-override': '0px',
  '--trees-level-gap-override': '0px',
  '--trees-item-margin-x-override': '0px',
  '--trees-item-padding-x-override': '0.625rem',
  '--trees-scrollbar-gutter-override': '6px',
  backgroundColor: 'var(--workspace)',
} as CSSProperties

export function DiffChangedFilesTree({
  files,
  selectedPaths,
  focusedFileCount,
  onSelectedPathsChange,
}: DiffChangedFilesTreeProps) {
  const paths = useMemo(() => files.map(resolveFileDiffPath).filter(Boolean), [files])
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => files.map((file) => ({ path: resolveFileDiffPath(file), status: getGitStatus(file) })),
    [files],
  )
  const fileStatsByPath = useMemo(() => {
    const stats = new Map<string, string>()
    for (const file of files) {
      const { additions, deletions } = getFileChangeCounts(file)
      stats.set(resolveFileDiffPath(file), `+${additions} −${deletions}`)
    }
    return stats
  }, [files])

  const fileStatsByPathRef = useRef(fileStatsByPath)
  fileStatsByPathRef.current = fileStatsByPath

  const { model } = useFileTree({
    density: 'compact',
    fileTreeSearchMode: 'hide-non-matches',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPaths,
    onSelectionChange: onSelectedPathsChange,
    paths,
    search: false,
    unsafeCSS: TREE_UNSAFE_CSS,
    renderRowDecoration: ({ item }) => {
      const text = fileStatsByPathRef.current.get(item.path)
      return text ? { text, title: text } : null
    },
  })

  const search = useFileTreeSearch(model)
  const searchValueRef = useRef(search.value)
  searchValueRef.current = search.value

  useEffect(() => {
    model.resetPaths(paths, { initialExpandedPaths: paths })
    model.setGitStatus(gitStatus)
    if (searchValueRef.current.trim().length > 0) {
      model.setSearch(searchValueRef.current)
    }
  }, [gitStatus, model, paths])

  useEffect(() => {
    model.setSearch(search.value)
  }, [model, search.value])

  const hasSelection = selectedPaths.length > 0
  const statusLabel = hasSelection
    ? `${focusedFileCount}/${paths.length} selected`
    : `${paths.length} changed`
  const clearSelection = () => {
    for (const path of model.getSelectedPaths()) {
      model.getItem(path)?.deselect()
    }
    onSelectedPathsChange([])
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-l border-[color:var(--border)] bg-[color:var(--workspace)]">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-2.5">
        <div className="min-w-0 flex-1 truncate pl-2.5 text-[12px] font-medium text-[color:var(--text)]">
          Changed
        </div>
        <div className="shrink-0 text-[11px] font-medium tabular-nums text-[color:var(--muted)]">
          {statusLabel}
        </div>
        {hasSelection ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
            onClick={clearSelection}
            aria-label="Clear file focus"
            data-tooltip="Clear file focus"
          >
            <FilterX size={13} />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--workspace)] px-2.5 pt-2 pb-2">
        <label
          className="flex min-h-8 shrink-0 items-center gap-2 rounded-[10px] border border-transparent bg-transparent px-2.5 text-[13px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] focus-within:bg-[rgba(255,255,255,0.05)] focus-within:text-[color:var(--text)]"
          data-active={search.value.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="shrink-0 text-[color:var(--muted)]" />
          <input
            value={search.value}
            onChange={(event) => search.setValue(event.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent p-0 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            aria-label="Search changed files"
          />
        </label>
        <FileTree
          model={model}
          className={cn('-mr-[6px] min-h-0 w-[calc(100%+6px)] flex-1')}
          style={treeHostStyle}
          aria-label="Changed files"
        />
      </div>
    </div>
  )
}
