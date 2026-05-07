import { Check, Search } from 'lucide-react'
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { ComposerModel, ComposerThinkingLevel } from '../../../desktop/types'
import { menuOptionClass, popoverPanelClass, toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { SurfacePanel } from '../../common/surface-panel'

type ComposerModelPopoverProps = {
  anchorRef: RefObject<HTMLButtonElement | null>
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  panelRef: RefObject<HTMLDivElement | null>
  preferSidePlacement?: boolean
  thinkingLevelLabels: Record<ComposerThinkingLevel, string>
  onSelectModel: (model: ComposerModel) => void
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void
}

const sidePlacementGap = 8
const sidePlacementViewportPadding = 12

type NestedMenu = 'provider' | 'model' | 'thinking' | null

type MenuOption = {
  id: string
  label: string
  description?: string
  selected: boolean
  onSelect: () => void
}

function TriggerButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        toolbarButtonClass,
        'grid w-full gap-0.5 rounded-xl px-2.5 py-2 text-left hover:bg-[color:var(--surface-hover)]',
        active && 'bg-[color:var(--accent-bg-subtle)] text-[color:var(--text)]',
      )}
      onClick={onClick}
    >
      <span className="text-[11px] text-[color:var(--muted)]">{label}</span>
      <span className="min-w-0 truncate text-[12px] text-[color:var(--text)]">{value}</span>
    </button>
  )
}

function MenuList({ items }: { items: MenuOption[] }) {
  return (
    <div
      role="menu"
      className={cn('-mx-1.5 -mt-1.5 pr-0', items.length > 10 && 'max-h-72 overflow-y-auto')}
    >
      <div className="grid min-w-0 pl-1 pt-1.5 pr-0 pb-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={item.selected}
            className={cn(
              menuOptionClass,
              'mr-1 text-[12px] text-[color:var(--text)]',
              item.selected && 'bg-[color:var(--accent-bg-subtle)]',
            )}
            onClick={item.onSelect}
          >
            <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
              {item.selected ? <Check size={13} /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              {item.description ? (
                <span className="block truncate text-[10.5px] text-[color:var(--muted)]">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function ComposerModelPopover({
  anchorRef,
  availableModels,
  availableThinkingLevels,
  currentModel,
  currentThinkingLevel,
  panelRef,
  preferSidePlacement = false,
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

  const [openMenu, setOpenMenu] = useState<NestedMenu>(null)
  const [selectedProvider, setSelectedProvider] = useState(currentModel?.provider ?? '')
  const [modelSearch, setModelSearch] = useState('')
  const [sidePlacementEnabled, setSidePlacementEnabled] = useState(false)
  const [sidePosition, setSidePosition] = useState({ left: 0, top: 0 })
  const [sidePositionReady, setSidePositionReady] = useState(false)
  const modelSearchRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const updatePlacementMode = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect()
      const estimatedPanelHeight = Math.min(
        360,
        window.innerHeight - sidePlacementViewportPadding * 2,
      )
      setSidePlacementEnabled(
        Boolean(
          anchorRect &&
            (preferSidePlacement ||
              anchorRect.top <
                estimatedPanelHeight + sidePlacementGap + sidePlacementViewportPadding),
        ),
      )
    }

    updatePlacementMode()
    window.addEventListener('resize', updatePlacementMode)
    window.addEventListener('scroll', updatePlacementMode, true)
    return () => {
      window.removeEventListener('resize', updatePlacementMode)
      window.removeEventListener('scroll', updatePlacementMode, true)
    }
  }, [anchorRef, preferSidePlacement])

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

  const openMenuItems = useMemo<MenuOption[]>(() => {
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

  useLayoutEffect(() => {
    if (!sidePlacementEnabled) {
      setSidePositionReady(false)
      return
    }

    const updatePosition = (event?: Event) => {
      const target = event?.target instanceof Node ? event.target : null
      if (target && panelRef.current?.contains(target)) {
        return
      }

      const anchorRect = anchorRef.current?.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()

      if (!(anchorRect && panelRect)) {
        return
      }

      const maxLeft = window.innerWidth - panelRect.width - sidePlacementViewportPadding
      const preferredLeft = anchorRect.right + sidePlacementGap
      const left = clamp(
        preferredLeft,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxLeft),
      )
      const maxTop = window.innerHeight - panelRect.height - sidePlacementViewportPadding
      const centeredTop = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2
      const top = clamp(
        centeredTop,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxTop),
      )

      setSidePosition((current) => {
        if (current.left === left && current.top === top) {
          return current
        }

        return { left, top }
      })
      setSidePositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  })

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
            className="h-8 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--panel-2)] px-2.5 pl-8 text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            placeholder={`Search ${modelsForProvider.length} models…`}
            aria-label="Search models"
          />
        </label>
      ) : null}
      {openMenuItems.length > 0 ? (
        <>
          <MenuList items={openMenuItems} />
          <div className="mx-2 mb-1 h-px bg-[color:var(--border)]" />
        </>
      ) : showModelSearch ? (
        <div className="px-2 py-3 text-[11px] text-[color:var(--muted)]">No matching models</div>
      ) : null}

      <div className="relative min-w-0">
        <TriggerButton
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
        <TriggerButton
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
        <TriggerButton
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
    'grid w-52 max-w-[calc(100vw-2rem)] overflow-x-hidden rounded-2xl border-[color:var(--border-strong)] p-1.5 text-[12px]',
    sidePlacementEnabled
      ? 'fixed z-[120] max-h-[calc(100vh-1.5rem)] overflow-y-auto transition-opacity duration-150 ease-out'
      : 'absolute bottom-[calc(100%+8px)] left-0 z-[60]',
    sidePlacementEnabled && !sidePositionReady && 'pointer-events-none opacity-0',
    popoverPanelClass,
  )

  const panelStyle: CSSProperties | undefined = sidePlacementEnabled
    ? { left: `${sidePosition.left}px`, top: `${sidePosition.top}px` }
    : undefined

  if (sidePlacementEnabled && typeof document !== 'undefined') {
    return createPortal(
      <SurfacePanel
        ref={panelRef}
        id="composer-model-menu"
        className={panelClassName}
        style={panelStyle}
      >
        {panelContents}
      </SurfacePanel>,
      document.body,
    )
  }

  return (
    <SurfacePanel ref={panelRef} id="composer-model-menu" className={panelClassName}>
      {panelContents}
    </SurfacePanel>
  )
}
