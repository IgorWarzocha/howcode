import type {
  ComposerModelPickerProps,
  ComposerProps,
  ComposerServices,
  InboxComposerProps,
  QueuedPromptsProps,
} from '@howaboua/howcode-sdk/composer-renderer'
import { getPersistedConversationId } from '@howaboua/howcode-sdk/conversation-ids'
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
import { useComposerDraftReceiver } from './composer-draft-receiver'
import { InstalledConversationActions } from './conversation-contributions'
import { isGitRendererApi } from './git-renderer-api'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

function useComposerBinding() {
  const renderers = useContext(RendererHostsContext)
  const renderer = renderers.find(({ contribution }) => contribution.composer)
  const draftInput = renderers.find(({ contribution }) => contribution.draftInput)
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
  return { renderer, services, generationKey }
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
  const { renderer, services, generationKey } = useComposerBinding()
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
  const conversationId = getPersistedConversationId(props.conversationId)
  return (
    <RendererSlot name={renderer.name}>
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
        conversationActions={
          conversationId ? <InstalledConversationActions conversationId={conversationId} /> : null
        }
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
  const { renderer, services, generationKey } = useComposerBinding()
  if (!renderer?.contribution.composer) return null
  const InboxComposer = renderer.contribution.composer.InboxComposer
  return (
    <RendererSlot name={renderer.name}>
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
