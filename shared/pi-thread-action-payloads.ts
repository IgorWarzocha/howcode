import type {
  AppSettings,
  ComposerAttachment,
  ComposerStateRequest,
  ComposerThinkingLevel,
  DesktopActionPayload,
  ModelSelection,
} from "./desktop-contracts";

const composerThinkingLevels = new Set<ComposerThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function getComposerRequest(payload: DesktopActionPayload): ComposerStateRequest {
  return {
    projectId: typeof payload.projectId === "string" ? payload.projectId : null,
    sessionPath: typeof payload.sessionPath === "string" ? payload.sessionPath : null,
  };
}

export function getProjectId(payload: DesktopActionPayload) {
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

export function getThreadId(payload: DesktopActionPayload) {
  return typeof payload.threadId === "string" ? payload.threadId : null;
}

export function getProjectName(payload: DesktopActionPayload) {
  const projectName = typeof payload.projectName === "string" ? payload.projectName.trim() : "";
  return projectName.length > 0 ? projectName : null;
}

export function getProjectIds(payload: DesktopActionPayload) {
  return Array.isArray(payload.projectIds)
    ? payload.projectIds.filter((projectId): projectId is string => typeof projectId === "string")
    : [];
}

export function getComposerText(payload: DesktopActionPayload) {
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

export function getComposerAttachments(payload: DesktopActionPayload): ComposerAttachment[] {
  return Array.isArray(payload.attachments)
    ? payload.attachments.filter(
        (attachment): attachment is ComposerAttachment =>
          typeof attachment === "object" &&
          attachment !== null &&
          typeof attachment.path === "string" &&
          typeof attachment.name === "string" &&
          (attachment.kind === "text" || attachment.kind === "image"),
      )
    : [];
}

export function getComposerModelSelection(payload: DesktopActionPayload) {
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const modelId = typeof payload.modelId === "string" ? payload.modelId : null;

  return provider && modelId ? { provider, modelId } : null;
}

export function getComposerThinkingLevel(payload: DesktopActionPayload) {
  const level = typeof payload.level === "string" ? payload.level : null;
  return level && composerThinkingLevels.has(level as ComposerThinkingLevel)
    ? (level as ComposerThinkingLevel)
    : null;
}

export function getGitCommitMessage(payload: DesktopActionPayload) {
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  return message.length > 0 ? message : null;
}

export function getGitIncludeUnstaged(payload: DesktopActionPayload) {
  return typeof payload.includeUnstaged === "boolean" ? payload.includeUnstaged : true;
}

export function getGitPush(payload: DesktopActionPayload) {
  return typeof payload.push === "boolean" ? payload.push : false;
}

export function getGitPreview(payload: DesktopActionPayload) {
  return payload.preview === true;
}

export function getGitRepoUrl(payload: DesktopActionPayload) {
  const repoUrl = typeof payload.repoUrl === "string" ? payload.repoUrl.trim() : "";
  return repoUrl.length > 0 ? repoUrl : null;
}

export function getSettingsKey(payload: DesktopActionPayload) {
  return payload.key === "gitCommitMessageModel" ||
    payload.key === "favoriteFolders" ||
    payload.key === "projectImportState" ||
    payload.key === "preferredProjectLocation" ||
    payload.key === "initializeGitOnProjectCreate"
    ? (payload.key as keyof AppSettings)
    : null;
}

export function getSettingsReset(payload: DesktopActionPayload) {
  return payload.reset === true;
}

export function getSettingsModelSelection(payload: DesktopActionPayload): ModelSelection | null {
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const id = typeof payload.modelId === "string" ? payload.modelId : null;

  return provider && id ? { provider, id } : null;
}

export function getSettingsFavoriteFolders(payload: DesktopActionPayload): string[] {
  return Array.isArray(payload.folders)
    ? [
        ...new Set(
          payload.folders
            .filter((folder): folder is string => typeof folder === "string")
            .map((folder) => folder.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

export function getSettingsProjectImportState(payload: DesktopActionPayload) {
  return payload.imported === null || typeof payload.imported === "boolean"
    ? payload.imported
    : null;
}

export function getSettingsPreferredProjectLocation(payload: DesktopActionPayload) {
  return typeof payload.value === "string" ? payload.value.trim() : null;
}

export function getSettingsBooleanValue(payload: DesktopActionPayload) {
  return typeof payload.value === "boolean" ? payload.value : null;
}
