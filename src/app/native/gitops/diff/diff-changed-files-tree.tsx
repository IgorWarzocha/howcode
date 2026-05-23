import type { FileDiffMetadata } from '@pierre/diffs/react'
import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react'
import { FilterX, Search } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef } from 'react'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  compactIconButtonClass,
  diffRailClass,
  diffRailHeaderClass,
  diffRailSearchClass,
  diffRailTreeWrapperClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { getFileChangeCounts, resolveFileDiffPath } from './diff-panel-content.helpers'

const TREE_UNSAFE_CSS = `
  :host {
    color-scheme: dark;
    --trees-fg-override: var(--text);
    --trees-muted-fg-override: var(--muted);
    --trees-bg-override: var(--workspace);
    --trees-bg-muted-override: var(--surface-hover);
    --trees-border-color-override: color-mix(in srgb, var(--border) 68%, transparent);
    --trees-search-bg-override: var(--surface-hover);
    --trees-search-fg-override: var(--text);
    --trees-selected-bg-override: var(--folded-row-bg);
    --trees-selected-fg-override: var(--text);
    --trees-focused-bg-override: var(--surface-hover);
    --trees-hover-bg-override: var(--surface-hover);
    --trees-border-radius-override: 9px;
    --trees-padding-inline-override: 0px;
    --trees-level-gap-override: 0px;
    --trees-item-margin-x-override: 0px;
    --trees-item-padding-x-override: 0.625rem;
    --trees-scrollbar-thumb-override: color-mix(in srgb, var(--muted) 34%, transparent);
    --trees-scrollbar-gutter-override: 6px;
    background: var(--workspace);
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
} as CSSProperties

export function DiffChangedFilesTree({
  files,
  selectedPaths,
  focusedFileCount,
  onSelectedPathsChange,
}: DiffChangedFilesTreeProps) {
  const filesWithPaths = useMemo(
    () =>
      files.flatMap((file) => {
        const path = resolveFileDiffPath(file)
        return path ? [{ file, path }] : []
      }),
    [files],
  )
  const paths = useMemo(() => filesWithPaths.map(({ path }) => path), [filesWithPaths])
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => filesWithPaths.map(({ file, path }) => ({ path, status: getGitStatus(file) })),
    [filesWithPaths],
  )
  const fileStatsByPath = useMemo(() => {
    const stats = new Map<string, string>()
    for (const { file, path } of filesWithPaths) {
      const { additions, deletions } = getFileChangeCounts(file)
      stats.set(path, `+${additions} −${deletions}`)
    }
    return stats
  }, [filesWithPaths])

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
    <div className={diffRailClass}>
      <div className={diffRailHeaderClass}>
        <div className={cn('min-w-0 flex-1 truncate px-2', appTypeSmallClass, appToneTextClass)}>
          Changed
        </div>
        <div className={cn('shrink-0 tabular-nums', appTypeMetaStrongClass, appToneMutedClass)}>
          {statusLabel}
        </div>
        {hasSelection ? (
          <button
            type="button"
            className={compactIconButtonClass}
            onClick={clearSelection}
            aria-label="Clear file focus"
            data-tooltip="Clear file focus"
          >
            <FilterX size={13} />
          </button>
        ) : null}
      </div>
      <div className={diffRailTreeWrapperClass}>
        <label
          className={cn(
            diffRailSearchClass,
            search.value.trim().length > 0 && 'bg-[color:var(--folded-row-hover-bg)]',
          )}
          data-active={search.value.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="shrink-0 text-[color:var(--muted)]" />
          <input
            value={search.value}
            onChange={(event) => search.setValue(event.target.value)}
            placeholder="Search"
            className={cn(
              'min-w-0 flex-1 bg-transparent p-0 outline-none placeholder:text-[color:var(--muted)]',
              appTypeGroupTextClass,
              appToneTextClass,
            )}
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
