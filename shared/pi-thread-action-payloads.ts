import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerThinkingLevel,
  DesktopActionPayload,
} from "./desktop-contracts.js";

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
