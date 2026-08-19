import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, type RefObject, useLayoutEffect, useState } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  DesktopActionInvoker,
  PiExtensionDialogRequest,
  PiExtensionStatus,
  PiExtensionWidget,
  ProjectTrustRequest,
} from '../desktop/types'
import { PiExtensionDialogCard, ProjectTrustCard } from '../features/pi-extensions'
import {
  appToneSubtleClass,
  appTypeTinyClass,
  composerOverlayPanelInsetClass,
  composerPopoverExtensionLayerClass,
  piExtensionTextClass,
} from '../ui/classes'
import { cn } from '../utils/cn'
import { PiExtensionWidgetLines } from './composer-pi-extension-widget'

const extensionStatusExpandedStorageKey = 'howcode.extensionStatusExpanded'
const piExtensionFoldedStorageKey = 'howcode.piExtensionFolded'
const piExtensionKeySeparatorPattern = /[-_.]+/u

type PiExtensionOverlaySection = {
  id: string
  name: string
  type: 'dialog' | 'widget'
  content: ReactNode
}

type PiExtensionOverlayContentProps = {
  widgets: PiExtensionWidget[]
  projectTrust: {
    request: ProjectTrustRequest | null
    onDecide: (trusted: boolean) => Promise<boolean>
  }
  nativeDialog: {
    request: PiExtensionDialogRequest | null
    onAnswer: (answer: {
      cancelled?: boolean | undefined
      confirmed?: boolean | undefined
      value?: string | undefined
    }) => Promise<boolean>
  }
}

type RunComposerAction = (
  action: DesktopAction,
  payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
  options?: { closeMenu?: boolean } | undefined,
) => Promise<boolean>

export function ComposerPiExtensionOverlay({
  chatGroupId,
  composerMode,
  dialogRequest,
  projectId,
  projectTrustRequest,
  runComposerAction,
  sessionPath,
  widgets,
}: {
  chatGroupId?: string | null | undefined
  composerMode: 'chat' | 'code'
  dialogRequest: PiExtensionDialogRequest | null
  projectId: string
  projectTrustRequest: ProjectTrustRequest | null
  runComposerAction: RunComposerAction
  sessionPath: string | null
  widgets: PiExtensionWidget[]
}) {
  return (
    <div className={cn('grid w-full min-w-0 gap-2', composerPopoverExtensionLayerClass)}>
      <PiExtensionOverlayContent
        widgets={widgets}
        projectTrust={{
          request: projectTrustRequest,
          onDecide: async (trusted) => {
            if (!projectTrustRequest) return false
            return await runComposerAction('composer.set-project-trust', {
              projectId,
              sessionPath,
              composerMode,
              chatGroupId,
              cwd: projectTrustRequest.cwd,
              trusted,
            })
          },
        }}
        nativeDialog={{
          request: dialogRequest,
          onAnswer: async (answer) => {
            if (!dialogRequest) return false
            return await runComposerAction('composer.answer-pi-extension-dialog', {
              projectId,
              sessionPath,
              composerMode,
              chatGroupId,
              requestId: dialogRequest.id,
              ...answer,
            })
          },
        }}
      />
    </div>
  )
}

function readExtensionStatusExpandedPreference() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(extensionStatusExpandedStorageKey) === 'true'
}

function readPiExtensionFoldedPreference() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(piExtensionFoldedStorageKey) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function writePiExtensionFoldedPreference(folded: Set<string>) {
  window.localStorage.setItem(piExtensionFoldedStorageKey, JSON.stringify([...folded]))
}

function getPiExtensionDisplayName(key: string) {
  return key
    .split(piExtensionKeySeparatorPattern)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

export function PiExtensionStatusLine({ statuses }: { statuses: PiExtensionStatus[] }) {
  const [expanded, setExpanded] = useState(readExtensionStatusExpandedPreference)
  if (statuses.length === 0) return null

  const toggleExpanded = () => {
    const next = !expanded
    window.localStorage.setItem(extensionStatusExpandedStorageKey, String(next))
    setExpanded(next)
  }

  return (
    <div className="grid py-1.5">
      <button
        type="button"
        className={cn(
          'grid min-w-0 grid-cols-[34px_minmax(0,1fr)_20px] items-start gap-0 rounded-md px-1 py-0.5 text-left',
          appTypeTinyClass,
          appToneSubtleClass,
        )}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse extension status' : 'Expand extension status'}
        onClick={toggleExpanded}
      >
        <span
          className={cn(
            'inline-flex h-4 w-full shrink-0 items-center justify-end pt-[2px] pr-[6px]',
            appToneSubtleClass,
          )}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span
          className={cn(
            'min-w-0 pt-[2px] pl-px',
            appTypeTinyClass,
            appToneSubtleClass,
            expanded ? 'grid gap-0.5' : 'truncate',
          )}
        >
          {expanded
            ? statuses.map((status) => (
                <span
                  key={status.key}
                  className={cn('truncate', appTypeTinyClass, appToneSubtleClass)}
                >
                  {status.text}
                </span>
              ))
            : statuses.map((status) => status.text).join(' · ')}
        </span>
        <span />
      </button>
    </div>
  )
}

export function useComposerExtensionStatusFooterOffset(input: {
  statusLineRef: RefObject<HTMLDivElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  visible: boolean
}) {
  const { statusLineRef, workspaceFooterRef, visible } = input

  useLayoutEffect(() => {
    const footer = workspaceFooterRef.current
    if (!footer) return

    const updateOffset = () => {
      const statusLine = statusLineRef.current
      const height =
        visible && statusLine ? Math.ceil(statusLine.getBoundingClientRect().height) : 0
      footer.style.setProperty('--composer-extension-status-height', `${height}px`)
    }

    updateOffset()

    if (typeof ResizeObserver === 'undefined' || !statusLineRef.current) {
      return () => {
        footer.style.removeProperty('--composer-extension-status-height')
      }
    }

    const observer = new ResizeObserver(updateOffset)
    observer.observe(statusLineRef.current)
    return () => {
      observer.disconnect()
      footer.style.removeProperty('--composer-extension-status-height')
    }
  }, [statusLineRef, visible, workspaceFooterRef])
}

function PiExtensionOverlayContent({
  nativeDialog,
  projectTrust,
  widgets,
}: PiExtensionOverlayContentProps) {
  const [foldedSections, setFoldedSections] = useState(readPiExtensionFoldedPreference)
  const sections: PiExtensionOverlaySection[] = [
    ...widgets.map((widget) => ({
      id: `widget:${widget.key}`,
      name: getPiExtensionDisplayName(widget.key),
      type: 'widget' as const,
      content: <PiExtensionWidgetLines widget={widget} />,
    })),
    ...(projectTrust.request
      ? [
          {
            id: 'dialog:project-trust',
            name: 'Project trust',
            type: 'dialog' as const,
            content: (
              <ProjectTrustCard
                request={projectTrust.request}
                embedded
                onDecide={projectTrust.onDecide}
              />
            ),
          },
        ]
      : []),
    ...(nativeDialog.request
      ? [
          {
            id: `dialog:${nativeDialog.request.id}`,
            name: 'Extension',
            type: 'dialog' as const,
            content: (
              <PiExtensionDialogCard
                request={nativeDialog.request}
                embedded
                onAnswer={nativeDialog.onAnswer}
              />
            ),
          },
        ]
      : []),
  ]

  if (sections.length === 0) return null

  const toggleSection = (sectionId: string) => {
    const next = new Set(foldedSections)
    if (next.has(sectionId)) next.delete(sectionId)
    else next.add(sectionId)
    setFoldedSections(next)
    writePiExtensionFoldedPreference(next)
  }

  return (
    <div className={cn('grid w-full min-w-0 overflow-visible', composerOverlayPanelInsetClass)}>
      <div className="grid w-full min-w-0 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] text-left shadow-none">
        {sections.map((section, index) => (
          <PiExtensionOverlaySection
            key={section.id}
            section={section}
            folded={foldedSections.has(section.id)}
            divided={index > 0}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PiExtensionOverlaySection({
  divided,
  folded,
  onToggle,
  section,
}: {
  divided: boolean
  folded: boolean
  onToggle: () => void
  section: PiExtensionOverlaySection
}) {
  if (!folded) {
    return (
      <section
        className={cn('relative min-w-0', divided && 'border-t border-[color:var(--border)]/70')}
      >
        <button
          type="button"
          className={cn(
            'absolute top-1 right-2 z-10 inline-flex h-5 w-5 items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]',
            piExtensionTextClass,
          )}
          aria-expanded
          aria-label={`Collapse ${section.name}`}
          onClick={onToggle}
        >
          <ChevronDown size={13} />
        </button>
        <div className="min-w-0 px-3 py-1.5">{section.content}</div>
      </section>
    )
  }

  return (
    <section
      className={cn('relative min-w-0', divided && 'border-t border-[color:var(--border)]/70')}
    >
      <button
        type="button"
        className={cn(
          'grid w-full items-center px-3 py-1.5 pr-9 text-left text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]',
          piExtensionTextClass,
        )}
        aria-expanded={false}
        aria-label={`Expand ${section.name}`}
        onClick={onToggle}
      >
        <span className="truncate">
          {section.name} - {section.type}
        </span>
        <span className="absolute top-1 right-2 inline-flex h-5 w-5 items-center justify-center">
          <ChevronLeft size={13} />
        </span>
      </button>
    </section>
  )
}
