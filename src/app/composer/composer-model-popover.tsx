import { Search } from 'lucide-react'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { AnchoredPopoverPanel, PopoverPanel } from '../common/popover'
import type { ComposerModel, ComposerThinkingLevel } from '../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerPopoverPanelClass,
} from '../ui/classes'
import { cn } from '../utils/cn'
import {
  type ComposerModelMenuOption,
  ModelPopoverMenuList,
  ModelPopoverTriggerButton,
  type NestedModelMenu,
} from './composer-model-popover-parts'

type ComposerModelPopoverProps = {
  anchorRef: RefObject<HTMLButtonElement | null>
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  panelRef: RefObject<HTMLDivElement | null>
  preferPortalPlacement?: boolean
  thinkingLevelLabels: Record<ComposerThinkingLevel, string>
  onSelectModel: (model: ComposerModel) => void
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void
}

export function ComposerModelPopover({
  anchorRef,
  availableModels,
  availableThinkingLevels,
  currentModel,
  currentThinkingLevel,
  panelRef,
  preferPortalPlacement = false,
  thinkingLevelLabels,
  onSelectModel,
  onSelectThinkingLevel,
}: ComposerModelPopoverProps) {
  const providers = useMemo(() => {
    const seen = new Set<string>()

    return availableModels.filter((model) => {
      if (seen.has(model.provider)) {
        return false
      }

      seen.add(model.provider)
      return true
    })
  }, [availableModels])

  const [openMenu, setOpenMenu] = useState<NestedModelMenu>(null)
  const [selectedProvider, setSelectedProvider] = useState(currentModel?.provider ?? '')
  const [modelSearch, setModelSearch] = useState('')
  const modelSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentModel?.provider) {
      setSelectedProvider(currentModel.provider)
      return
    }

    setSelectedProvider(providers[0]?.provider ?? '')
  }, [currentModel?.provider, providers])

  const modelsForProvider = useMemo(
    () => availableModels.filter((model) => model.provider === selectedProvider),
    [availableModels, selectedProvider],
  )

  const normalizedModelSearch = modelSearch.trim().toLowerCase()
  const visibleModelsForProvider = useMemo(() => {
    if (!normalizedModelSearch) {
      return modelsForProvider
    }

    return modelsForProvider.filter((model) =>
      `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(normalizedModelSearch),
    )
  }, [modelsForProvider, normalizedModelSearch])

  const currentModelForSelectedProvider =
    currentModel?.provider === selectedProvider ? currentModel : null

  const openMenuItems = useMemo<ComposerModelMenuOption[]>(() => {
    if (openMenu === 'provider') {
      return providers.map((provider) => ({
        id: provider.provider,
        label: provider.provider,
        selected: provider.provider === selectedProvider,
        onSelect: () => {
          setSelectedProvider(provider.provider)
        },
      }))
    }

    if (openMenu === 'model') {
      return visibleModelsForProvider.map((availableModel) => ({
        id: `${availableModel.provider}/${availableModel.id}`,
        label: availableModel.name,
        description: `${availableModel.provider}/${availableModel.id}`,
        selected:
          currentModel?.provider === availableModel.provider &&
          currentModel.id === availableModel.id,
        onSelect: () => {
          onSelectModel(availableModel)
        },
      }))
    }

    if (openMenu === 'thinking') {
      return availableThinkingLevels.map((level) => ({
        id: level,
        label: thinkingLevelLabels[level],
        selected: level === currentThinkingLevel,
        onSelect: () => {
          onSelectThinkingLevel(level)
          setOpenMenu(null)
        },
      }))
    }

    return []
  }, [
    availableThinkingLevels,
    currentModel?.id,
    currentModel?.provider,
    currentThinkingLevel,
    onSelectModel,
    onSelectThinkingLevel,
    openMenu,
    providers,
    selectedProvider,
    thinkingLevelLabels,
    visibleModelsForProvider,
  ])

  const showModelSearch = openMenu === 'model' && modelsForProvider.length > 12

  useEffect(() => {
    if (showModelSearch) {
      modelSearchRef.current?.focus()
    }
  }, [showModelSearch])

  const panelContents = (
    <>
      {showModelSearch ? (
        <label className="relative mb-1 block">
          <Search
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            ref={modelSearchRef}
            value={modelSearch}
            onChange={(event) => setModelSearch(event.currentTarget.value)}
            className={cn(
              'h-7 w-full rounded-md border-0 bg-[color:var(--surface-hover)] px-2.5 pl-8 outline-none placeholder:text-[color:var(--muted)] focus:bg-[color:var(--surface-hover)]',
              appTypeMetaClass,
              appToneTextClass,
            )}
            placeholder={`Search ${modelsForProvider.length} models…`}
            aria-label="Search models"
          />
        </label>
      ) : null}
      {openMenuItems.length > 0 ? (
        <>
          <ModelPopoverMenuList items={openMenuItems} />
          <div className="mx-2 mb-1 h-px bg-[color:var(--border)]" />
        </>
      ) : showModelSearch ? (
        <div className={cn('px-2 py-3', appTypeMetaClass, appToneMutedClass)}>
          No matching models
        </div>
      ) : null}

      <div className="relative min-w-0">
        <ModelPopoverTriggerButton
          label="Provider"
          value={selectedProvider || 'Choose provider'}
          active={openMenu === 'provider'}
          onClick={() => {
            setModelSearch('')
            setOpenMenu((current) => (current === 'provider' ? null : 'provider'))
          }}
        />
      </div>

      <div className="relative min-w-0">
        <ModelPopoverTriggerButton
          label="Model"
          value={
            currentModelForSelectedProvider?.name ?? modelsForProvider[0]?.name ?? 'Choose model'
          }
          active={openMenu === 'model'}
          onClick={() => {
            setOpenMenu((current) => {
              if (current === 'model') {
                setModelSearch('')
                return null
              }

              return 'model'
            })
          }}
        />
      </div>

      <div className="relative min-w-0">
        <ModelPopoverTriggerButton
          label="Reasoning"
          value={thinkingLevelLabels[currentThinkingLevel]}
          active={openMenu === 'thinking'}
          onClick={() => {
            setModelSearch('')
            setOpenMenu((current) => (current === 'thinking' ? null : 'thinking'))
          }}
        />
      </div>
    </>
  )

  const panelClassName = cn(
    'pointer-events-auto grid w-52 max-w-[calc(100vw-2rem)] overflow-x-hidden rounded-xl border-0 p-1.5',
    appTypeSmallClass,
    preferPortalPlacement
      ? 'max-h-[calc(100vh-1.5rem)] overflow-y-auto'
      : 'absolute bottom-[calc(100%+8px)] left-0 z-[60]',
    composerPopoverPanelClass,
  )

  if (preferPortalPlacement) {
    return (
      <AnchoredPopoverPanel
        anchorRef={anchorRef}
        panelRef={panelRef}
        open
        surface={false}
        id="composer-model-menu"
        placement="top-start"
        className={panelClassName}
      >
        {panelContents}
      </AnchoredPopoverPanel>
    )
  }

  return (
    <PopoverPanel
      surface={false}
      ref={panelRef}
      id="composer-model-menu"
      className={panelClassName}
    >
      {panelContents}
    </PopoverPanel>
  )
}
