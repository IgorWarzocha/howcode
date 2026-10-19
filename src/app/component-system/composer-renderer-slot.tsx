import type {
  ComposerActionContext,
  ComposerModelPickerProps,
  ComposerProps,
  ComposerServices,
  InboxComposerProps,
  QueuedPromptsProps,
} from '@howaboua/howcode-sdk/composer-renderer'
import { useContext, useMemo } from 'react'
import type { DirectoryGitState } from '../desktop/types'
import {
  canUploadComposerFilesQuery,
  getComposerSkillsQuery,
  getComposerSlashCommandsQuery,
  getConversationEntriesQuery,
  openExternalQuery,
  searchComposerAttachmentEntriesQuery,
  uploadComposerFilesQuery,
} from '../query/desktop-query'
import { InstalledArtifactComposerControl } from './artifact-renderer-slot'
import { InstalledComposerActions } from './composer-actions-slot'
import { useComposerDraftReceiver } from './composer-draft-receiver'
import { useDictationProviderSelection } from './dictation-provider-selection'
import { isGitRendererApi } from './git-renderer-api'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

function useComposerBinding() {
  const renderers = useContext(RendererHostsContext)
  const renderer = renderers.find(({ contribution }) => contribution.composer)
  const { renderer: draftInput, error: dictationError } = useDictationProviderSelection()
  const services = useMemo<ComposerServices>(
    () => ({
      getComposerSkills: getComposerSkillsQuery,
      getComposerSlashCommands: getComposerSlashCommandsQuery,
      searchAttachments: searchComposerAttachmentEntriesQuery,
      getConversationEntries: getConversationEntriesQuery,
      canUploadFiles: canUploadComposerFilesQuery,
      uploadFiles: uploadComposerFilesQuery,
      openExternal: openExternalQuery,
      draftInput: draftInput?.contribution.draftInput
        ? { api: draftInput.contribution.draftInput, host: draftInput.host }
        : null,
    }),
    [draftInput],
  )
  const generationKey = `${renderer?.reference?.revision ?? renderer?.name ?? ''}:${draftInput?.reference?.revision ?? draftInput?.name ?? ''}`
  return { renderer, services, generationKey, dictationError }
}

function renderComposerActions(composer: ComposerActionContext) {
  return <InstalledComposerActions composer={composer} />
}

function DictationWarning({
  error,
  onOpenSettingsView,
}: {
  error: string | null
  onOpenSettingsView: ComposerProps['onOpenSettingsView']
}) {
  return error ? (
    <p role="status" className="px-2 py-1 text-sm">
      {error}{' '}
      <button
        type="button"
        className="underline"
        onClick={() =>
          onOpenSettingsView({ category: 'chat', settingId: 'common.dictation-provider' })
        }
      >
        Choose provider
      </button>
    </p>
  ) : null
}

type InstalledComposerProps = Omit<ComposerProps, 'services' | 'registerDraftReceiver'> & {
  directoryGitState?: DirectoryGitState | null
  parentBranchName?: string | null
  onToggleTerminal: () => void
  terminalVisible: boolean
  showTerminalControls?: boolean
  artifactsAvailable?: boolean
  artifactsVisible?: boolean
  artifactRendererName?: string | null
  onToggleArtifacts?: (() => void) | undefined
  onToggleArtifactRenderer?: (name: string) => void
}

export function InstalledComposer({
  directoryGitState = null,
  parentBranchName,
  onToggleTerminal,
  terminalVisible,
  showTerminalControls = true,
  artifactsAvailable = false,
  artifactsVisible = false,
  artifactRendererName,
  onToggleArtifacts,
  onToggleArtifactRenderer,
  ...props
}: InstalledComposerProps) {
  const { renderer, services, generationKey, dictationError } = useComposerBinding()
  const { register } = useComposerDraftReceiver()
  const renderers = useContext(RendererHostsContext)
  if (!renderer?.contribution.composer) return null
  const Composer = renderer.contribution.composer.Composer
  const terminal = renderers.find(({ contribution }) => contribution.TerminalComposerControl)
  const TerminalControl = terminal?.contribution.TerminalComposerControl
  const git = renderers.find(({ contribution }) => isGitRendererApi(contribution.git))
  const GitControls = isGitRendererApi(git?.contribution.git)
    ? git.contribution.git.GitComposerControls
    : undefined
  return (
    <RendererSlot name={renderer.name}>
      <DictationWarning error={dictationError} onOpenSettingsView={props.onOpenSettingsView} />
      <Composer
        {...props}
        key={generationKey}
        services={services}
        registerDraftReceiver={register}
        leadingFooter={
          showTerminalControls && terminal && TerminalControl ? (
            <RendererSlot name={terminal.name}>
              <TerminalControl
                host={terminal.host}
                visible={terminalVisible}
                onToggle={onToggleTerminal}
              />
            </RendererSlot>
          ) : null
        }
        composerActions={renderComposerActions}
        trailingFooter={(composerPanelRef) => (
          <>
            {git && GitControls ? (
              <RendererSlot name={git.name}>
                <GitControls
                  selector={{
                    controlsRef: composerPanelRef,
                    directoryId: props.directoryId,
                    directoryGitState,
                    parentBranchName,
                  }}
                  showGitOps={showTerminalControls}
                />
              </RendererSlot>
            ) : null}
            <InstalledArtifactComposerControl
              available={artifactsAvailable}
              visible={artifactsVisible}
              {...(artifactRendererName === undefined
                ? {}
                : { rendererName: artifactRendererName })}
              {...(onToggleArtifactRenderer ? { onToggleRenderer: onToggleArtifactRenderer } : {})}
              {...(onToggleArtifacts ? { onToggle: onToggleArtifacts } : {})}
            />
          </>
        )}
      />
    </RendererSlot>
  )
}

export function InstalledInboxComposer(props: Omit<InboxComposerProps, 'services'>) {
  const { renderer, services, generationKey, dictationError } = useComposerBinding()
  if (!renderer?.contribution.composer) return null
  const InboxComposer = renderer.contribution.composer.InboxComposer
  return (
    <RendererSlot name={renderer.name}>
      <DictationWarning error={dictationError} onOpenSettingsView={props.onOpenSettingsView} />
      <InboxComposer {...props} key={`${generationKey}:${props.chat.chatId}`} services={services} />
    </RendererSlot>
  )
}

export function InstalledQueuedPrompts(props: QueuedPromptsProps) {
  const { renderer } = useComposerBinding()
  if (!renderer?.contribution.composer) return null
  const QueuedPrompts = renderer.contribution.composer.QueuedPrompts
  return (
    <RendererSlot name={renderer.name}>
      <QueuedPrompts {...props} />
    </RendererSlot>
  )
}

export function InstalledComposerModelPicker(props: ComposerModelPickerProps) {
  const { renderer } = useComposerBinding()
  if (!renderer?.contribution.composer) return null
  const ModelPicker = renderer.contribution.composer.ModelPicker
  return (
    <RendererSlot name={renderer.name}>
      <ModelPicker {...props} />
    </RendererSlot>
  )
}
