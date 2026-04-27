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
} from "../../shared/desktop-contracts.ts";
import {
  getDictationState as getSherpaDictationState,
  installDictationModel as installSherpaDictationModel,
  listDictationModels as listSherpaDictationModels,
  removeDictationModel as removeSherpaDictationModel,
  transcribeDictation as transcribeSherpaDictation,
} from "../dictation/sherpa-onnx.cts";
import {
  getComposerState,
  getComposerSlashCommands,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from "../pi-desktop-runtime.cts";
import {
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiff,
  loadProjectDiffStats,
  loadProjectGitState,
} from "../project-git.cts";
import { setWatchedSessionPath } from "./session-watch.cts";
export { loadInboxThreadList } from "./thread-loader.cts";
export { refreshShellIndex } from "./shell-index.cts";
export { loadShellState } from "./shell-state.cts";

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request);
}

export async function loadComposerSlashCommands(request: ComposerStateRequest = {}) {
  return getComposerSlashCommands(request);
}

export async function getDictationState(): Promise<DictationState> {
  return getSherpaDictationState();
}

export async function listDictationModels(): Promise<DictationModelSummary[]> {
  return listSherpaDictationModels();
}

export async function installDictationModel(request: {
  modelId: "tiny.en" | "base.en" | "small.en";
}): Promise<DictationModelInstallResult> {
  return installSherpaDictationModel(request.modelId);
}

export async function removeDictationModel(request: {
  modelId: "tiny.en" | "base.en" | "small.en";
}): Promise<DictationModelRemoveResult> {
  return removeSherpaDictationModel(request.modelId);
}

export async function transcribeDictation(
  request: DictationTranscriptionRequest,
): Promise<DictationTranscriptionResult> {
  return transcribeSherpaDictation(request);
}

export async function loadProjectCommitHistory(
  projectId: string,
  limit?: number | null,
): Promise<ProjectCommitEntry[]> {
  return listProjectCommits(projectId, limit ?? null);
}

export { loadProjectGitState };
export { loadProjectDiff };
export { loadProjectDiffStats };
export { captureProjectDiffBaseline };
export { listProjectCommits };
export { setWatchedSessionPath };

export const subscribeDesktopEvents = subscribeRuntimeEvents;
