import type {
  AppSettings,
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionPayloadInput,
  ModelSelection,
  ProjectDeletionMode,
} from "./desktop-contracts";
import { getPersistedSessionPath } from "./session-paths";

const composerThinkingLevels = new Set<ComposerThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function getComposerRequest(payload: DesktopActionPayloadInput): ComposerStateRequest {
  return {
    projectId: typeof payload.projectId === "string" ? payload.projectId : null,
    sessionPath: getPersistedSessionPath(
      typeof payload.sessionPath === "string" ? payload.sessionPath : null,
    ),
  };
}

export function getProjectId(payload: DesktopActionPayloadInput) {
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

export function getSessionPath(payload: DesktopActionPayloadInput) {
  return typeof payload.sessionPath === "string" ? payload.sessionPath : null;
}

export function getThreadId(payload: DesktopActionPayloadInput) {
  return typeof payload.threadId === "string" ? payload.threadId : null;
}

export function getThreadIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.threadIds)
    ? payload.threadIds.filter(
        (threadId: unknown): threadId is string => typeof threadId === "string",
      )
    : [];
}

export function getProjectName(payload: DesktopActionPayloadInput) {
  const projectName = typeof payload.projectName === "string" ? payload.projectName.trim() : "";
  return projectName.length > 0 ? projectName : null;
}

export function getProjectIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.projectIds)
    ? payload.projectIds.filter(
        (projectId: unknown): projectId is string => typeof projectId === "string",
      )
    : [];
}

export function getComposerText(payload: DesktopActionPayloadInput) {
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

export function getComposerAttachments(payload: DesktopActionPayloadInput): ComposerAttachment[] {
  return Array.isArray(payload.attachments)
    ? payload.attachments.filter((attachment: unknown): attachment is ComposerAttachment => {
        if (typeof attachment !== "object" || attachment === null) {
          return false;
        }

        const candidate = attachment as Partial<ComposerAttachment>;
        return (
          typeof candidate.path === "string" &&
          typeof candidate.name === "string" &&
          (candidate.kind === "text" || candidate.kind === "image")
        );
      })
    : [];
}

export function getComposerStreamingBehavior(
  payload: DesktopActionPayloadInput,
): ComposerStreamingBehavior | null {
  return payload.streamingBehavior === "steer" ||
    payload.streamingBehavior === "followUp" ||
    payload.streamingBehavior === "stop"
    ? payload.streamingBehavior
    : null;
}

export function getComposerQueueMode(payload: DesktopActionPayloadInput) {
  return payload.queueMode === "steer" || payload.queueMode === "followUp"
    ? payload.queueMode
    : null;
}

export function getComposerQueueId(payload: DesktopActionPayloadInput) {
  return typeof payload.queueId === "string" && payload.queueId.length > 0 ? payload.queueId : null;
}

export function getComposerQueueSnapshotKey(payload: DesktopActionPayloadInput) {
  return typeof payload.queueSnapshotKey === "string" && payload.queueSnapshotKey.length > 0
    ? payload.queueSnapshotKey
    : null;
}

export function getComposerQueueIndex(payload: DesktopActionPayloadInput) {
  return typeof payload.queueIndex === "number" && Number.isInteger(payload.queueIndex)
    ? payload.queueIndex
    : null;
}

export function getComposerModelSelection(payload: DesktopActionPayloadInput) {
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const modelId = typeof payload.modelId === "string" ? payload.modelId : null;

  return provider && modelId ? { provider, modelId } : null;
}

export function getComposerThinkingLevel(payload: DesktopActionPayloadInput) {
  const level = typeof payload.level === "string" ? payload.level : null;
  return level && composerThinkingLevels.has(level as ComposerThinkingLevel)
    ? (level as ComposerThinkingLevel)
    : null;
}

export function getGitCommitMessage(payload: DesktopActionPayloadInput) {
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  return message.length > 0 ? message : null;
}

export function getGitIncludeUnstaged(payload: DesktopActionPayloadInput) {
  return typeof payload.includeUnstaged === "boolean" ? payload.includeUnstaged : true;
}

export function getGitPush(payload: DesktopActionPayloadInput) {
  return typeof payload.push === "boolean" ? payload.push : false;
}

export function getGitPreview(payload: DesktopActionPayloadInput) {
  return payload.preview === true;
}

export function getGitRepoUrl(payload: DesktopActionPayloadInput) {
  const repoUrl = typeof payload.repoUrl === "string" ? payload.repoUrl.trim() : "";
  return repoUrl.length > 0 ? repoUrl : null;
}

export function getSettingsKey(payload: DesktopActionPayloadInput) {
  return payload.key === "gitCommitMessageModel" ||
    payload.key === "skillCreatorModel" ||
    payload.key === "composerStreamingBehavior" ||
    payload.key === "showDictationButton" ||
    payload.key === "favoriteFolders" ||
    payload.key === "projectImportState" ||
    payload.key === "preferredProjectLocation" ||
    payload.key === "initializeGitOnProjectCreate" ||
    payload.key === "projectDeletionMode" ||
    payload.key === "useAgentsSkillsPaths" ||
    payload.key === "piTuiTakeover"
    ? (payload.key as keyof AppSettings)
    : null;
}

export function getSettingsReset(payload: DesktopActionPayloadInput) {
  return payload.reset === true;
}

export function getSettingsModelSelection(
  payload: DesktopActionPayloadInput,
): ModelSelection | null {
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const id = typeof payload.modelId === "string" ? payload.modelId : null;

  return provider && id ? { provider, id } : null;
}

export function getSettingsFavoriteFolders(payload: DesktopActionPayloadInput): string[] {
  return Array.isArray(payload.folders)
    ? [
        ...new Set(
          payload.folders
            .filter((folder: unknown): folder is string => typeof folder === "string")
            .map((folder) => folder.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

export function getSettingsProjectImportState(payload: DesktopActionPayloadInput) {
  return payload.imported === null || typeof payload.imported === "boolean"
    ? payload.imported
    : null;
}

export function getSettingsPreferredProjectLocation(payload: DesktopActionPayloadInput) {
  return typeof payload.value === "string" ? payload.value.trim() : null;
}

export function getSettingsBooleanValue(payload: DesktopActionPayloadInput) {
  return typeof payload.value === "boolean" ? payload.value : null;
}

export function getSettingsComposerStreamingBehavior(
  payload: DesktopActionPayloadInput,
): ComposerStreamingBehavior | null {
  return payload.value === "steer" || payload.value === "followUp" || payload.value === "stop"
    ? payload.value
    : null;
}

export function getSettingsProjectDeletionMode(
  payload: DesktopActionPayloadInput,
): ProjectDeletionMode | null {
  return payload.value === "pi-only" || payload.value === "full-clean" ? payload.value : null;
}
