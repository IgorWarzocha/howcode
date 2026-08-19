import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { desktopQueryKeys, searchPiPackagesQuery } from '../../query/desktop-query'
import { getActionError } from '../utils'

export function useExtensionCatalog({
  installedIdentityKeys,
  onInstall,
}: {
  installedIdentityKeys: Set<string>
  onInstall: (source: string, kind: 'npm') => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [submittedSearchInput, setSubmittedSearchInput] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const packagesQuery = useInfiniteQuery({
    queryKey: desktopQueryKeys.piPackageCatalog(submittedSearchInput),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchPiPackagesQuery({
        query: submittedSearchInput,
        cursor: typeof pageParam === 'number' ? pageParam : 0,
        pageSize: 20,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
    enabled: submittedSearchInput.length >= 2,
  })
  const items = useMemo(
    () => packagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [packagesQuery.data?.pages],
  )

  useEffect(() => {
    setSelectedSources((current) =>
      current.filter((source) => {
        const item = items.find((candidate) => candidate.source === source)
        return item ? !installedIdentityKeys.has(item.identityKey) : false
      }),
    )
  }, [installedIdentityKeys, items])

  const toggleSelectedSource = (source: string) => {
    setSelectedSources((current) =>
      current.includes(source)
        ? current.filter((selectedSource) => selectedSource !== source)
        : [...current, source],
    )
  }

  const installSelected = async () => {
    const successfulSources = new Set<string>()
    await selectedSources.reduce<Promise<void>>(
      (pending, source) =>
        pending.then(async () => {
          if (await onInstall(source, 'npm')) successfulSources.add(source.trim().toLowerCase())
        }),
      Promise.resolve(),
    )
    if (successfulSources.size === 0) return
    setSelectedSources((current) =>
      current.filter((source) => !successfulSources.has(source.trim().toLowerCase())),
    )
  }

  return {
    error: packagesQuery.isError ? getActionError(packagesQuery.error) : null,
    hasNextPage: Boolean(packagesQuery.hasNextPage),
    installSelected,
    isFetchingNextPage: packagesQuery.isFetchingNextPage,
    isLoading: packagesQuery.isLoading,
    items,
    loadMore: () => void packagesQuery.fetchNextPage(),
    open,
    searchInput,
    selectedSources,
    setOpen,
    setSearchInput,
    setSubmittedSearchInput,
    submittedSearchInput,
    toggleSelectedSource,
  }
}
