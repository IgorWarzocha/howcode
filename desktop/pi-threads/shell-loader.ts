import type {
  ComposerState,
  ComposerStateRequest,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
  ProjectCommitEntry,
} from '../../shared/desktop-contracts.ts'
import {
  getDictationState as getSherpaDictationState,
  installDictationModel as installSherpaDictationModel,
  listDictationModels as listSherpaDictationModels,
  removeDictationModel as removeSherpaDictationModel,
  transcribeDictation as transcribeSherpaDictation,
} from '../dictation/sherpa-onnx.ts'
import { disposeDurableRuntime } from '../durable-runtime/host.ts'
import {
  disposeThreadUpdateForwarding,
  getComposerSkills,
  getComposerSlashCommands,
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from '../pi-desktop-runtime.ts'
import {
  cancelProjectDiffStream,
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiffFileContents,
  loadProjectDiffImagePreview,
  loadProjectDiffStats,
  loadProjectGitState,
  startProjectDiffStream,
} from '../project-git.ts'
import { disposeWorkspaceOperations } from '../runtime/keyed-workspace-operations.ts'
import { disposeConversationProjection } from './conversation-projection.ts'

export { refreshShellIndex } from './shell-index.ts'
export { loadShellState } from './shell-state.ts'
export { loadInboxThreadList } from './thread-loader.ts'

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request)
}

export async function loadComposerSlashCommands(request: ComposerStateRequest = {}) {
  return getComposerSlashCommands(request)
}

export async function loadComposerSkills(request: ComposerStateRequest = {}) {
  return getComposerSkills(request)
}

export async function getDictationState(): Promise<DictationState> {
  return getSherpaDictationState()
}

export async function listDictationModels(): Promise<DictationModelSummary[]> {
  return listSherpaDictationModels()
}

export async function installDictationModel(request: {
  modelId: 'tiny.en' | 'base.en' | 'small.en'
}): Promise<DictationModelInstallResult> {
  return installSherpaDictationModel(request.modelId)
}

export async function removeDictationModel(request: {
  modelId: 'tiny.en' | 'base.en' | 'small.en'
}): Promise<DictationModelRemoveResult> {
  return removeSherpaDictationModel(request.modelId)
}

export async function transcribeDictation(
  request: DictationTranscriptionRequest,
): Promise<DictationTranscriptionResult> {
  return transcribeSherpaDictation(request)
}

export async function loadProjectCommitHistory(
  projectId: string,
  limit?: number | undefined | null,
): Promise<ProjectCommitEntry[]> {
  return listProjectCommits(projectId, limit ?? null)
}

export {
  cancelProjectDiffStream,
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiffFileContents,
  loadProjectDiffImagePreview,
  loadProjectDiffStats,
  loadProjectGitState,
  startProjectDiffStream,
}

export const subscribeDesktopEvents = subscribeRuntimeEvents

export async function disposeDesktopRuntime() {
  const results = await Promise.allSettled([
    disposeConversationProjection(),
    disposeWorkspaceOperations(),
    disposeThreadUpdateForwarding(),
  ])
  // The Harness is closed only after projection reads and watch publishers have settled.
  results.push(...(await Promise.allSettled([disposeDurableRuntime()])))
  const failures = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  )
  if (failures.length > 0) throw new AggregateError(failures, 'Failed to dispose desktop runtime.')
}
