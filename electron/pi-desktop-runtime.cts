import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type {
  ComposerAttachment,
  ComposerModel,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
  DesktopEvent,
  Message,
  ThreadData,
} from "../shared/desktop-contracts.js";
import { saveThreadCache, upsertThreadSummary } from "./thread-state-db.cjs";

type PiModule = typeof import("@mariozechner/pi-coding-agent");

type PiRuntime = {
  cwd: string;
  session: AgentSession;
};

type RuntimeThreadReason = Extract<DesktopEvent, { type: "thread-update" }>["reason"];

type TextPart = {
  type?: string;
  text?: string;
};

type MessageWithContent = {
  role?: string;
  content?: string | TextPart[];
  timestamp?: string | number;
};

type ProcessedComposerAttachments = {
  text: string;
  images: ImageContent[];
};

const runtimePromises = new Map<string, Promise<PiRuntime>>();
const liveThreads = new Map<string, ThreadData>();
const sessionPathToCwd = new Map<string, string>();
const desktopListeners = new Set<(event: DesktopEvent) => void>();
let piModulePromise: Promise<PiModule> | undefined;

function getPiModule() {
  if (!piModulePromise) {
    piModulePromise = import("@mariozechner/pi-coding-agent");
  }

  return piModulePromise;
}

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

function normalizeThreadTitle(value: unknown) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "New thread";
  }

  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function isTextPart(part: unknown): part is TextPart {
  return typeof part === "object" && part !== null;
}

function extractTextContent(content: MessageWithContent["content"]) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => isTextPart(part) && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function mapRuntimeMessageToUiMessage(message: AgentMessage, index: number): Message | null {
  const runtimeMessage = message as MessageWithContent;

  if (runtimeMessage.role === "user") {
    const text = extractTextContent(runtimeMessage.content);
    if (!text) {
      return null;
    }

    return {
      id: `${runtimeMessage.timestamp ?? index}-user-${index}`,
      role: "user",
      content: [text],
    };
  }

  if (runtimeMessage.role === "assistant") {
    const paragraphs = Array.isArray(runtimeMessage.content)
      ? runtimeMessage.content
          .filter(
            (part) => isTextPart(part) && part.type === "text" && typeof part.text === "string",
          )
          .flatMap((part) => splitParagraphs(part.text ?? ""))
      : [];

    if (paragraphs.length === 0) {
      return null;
    }

    return {
      id: `${runtimeMessage.timestamp ?? index}-assistant-${index}`,
      role: "assistant",
      content: paragraphs,
    };
  }

  return null;
}

function mapComposerModel(model: AgentSession["model"]): ComposerModel | null {
  if (!model) {
    return null;
  }

  return {
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: (model.input ?? ["text"]) as Array<"text" | "image">,
  };
}

function mapThinkingLevels(levels: ThinkingLevel[]) {
  return levels as ComposerThinkingLevel[];
}

function isImageAttachment(filePath: string) {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(path.extname(filePath).toLowerCase());
}

function getImageMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

async function processComposerAttachments(
  attachments: ComposerAttachment[],
): Promise<ProcessedComposerAttachments> {
  let text = "";
  const images: ImageContent[] = [];

  for (const attachment of attachments) {
    const fileStats = await stat(attachment.path);
    if (fileStats.size === 0) {
      continue;
    }

    if (isImageAttachment(attachment.path)) {
      const mimeType = getImageMimeType(attachment.path);
      if (!mimeType) {
        continue;
      }

      const content = await readFile(attachment.path);
      images.push({
        type: "image",
        mimeType,
        data: content.toString("base64"),
      });
      text += `<file name="${attachment.path}"></file>\n`;
      continue;
    }

    const content = await readFile(attachment.path, "utf-8");
    text += `<file name="${attachment.path}">\n${content}\n</file>\n`;
  }

  return {
    text,
    images,
  };
}

async function createRuntime(cwd: string): Promise<PiRuntime> {
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    createAgentSession,
    getAgentDir,
  } = await getPiModule();
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const sessionDir = settingsManager.getSessionDir() ?? undefined;
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager: SessionManager.create(cwd, sessionDir),
  });

  const runtime = {
    cwd,
    session,
  };

  if (session.sessionFile) {
    sessionPathToCwd.set(session.sessionFile, cwd);
  }

  session.subscribe((event) => {
    if (event.type === "message_end") {
      const message = event.message as MessageWithContent;
      if (message.role === "user") {
        void publishThreadUpdate(runtime, "start");
      }
      if (message.role === "assistant") {
        void publishThreadUpdate(runtime, "end");
      }
      return;
    }

    if (event.type === "message_update") {
      const message = event.message as MessageWithContent;
      if (message.role === "assistant") {
        void publishThreadUpdate(runtime, "update");
      }
    }
  });

  return runtime;
}

async function getRuntime(cwd: string) {
  const existingRuntime = runtimePromises.get(cwd);
  if (existingRuntime) {
    return existingRuntime;
  }

  const runtimePromise = createRuntime(cwd);
  runtimePromises.set(cwd, runtimePromise);
  return runtimePromise;
}

async function resolveCwd(request: ComposerStateRequest = {}) {
  if (request.sessionPath) {
    const mappedCwd = sessionPathToCwd.get(request.sessionPath);
    if (mappedCwd) {
      return mappedCwd;
    }

    const { SessionManager } = await getPiModule();
    return SessionManager.open(request.sessionPath).getCwd();
  }

  if (request.projectId) {
    return request.projectId;
  }

  return process.cwd();
}

async function activateSession(runtime: PiRuntime, request: ComposerStateRequest = {}) {
  if (request.sessionPath && runtime.session.sessionFile !== request.sessionPath) {
    await runtime.session.switchSession(request.sessionPath);
  }

  return runtime;
}

async function getRuntimeForRequest(request: ComposerStateRequest = {}) {
  const cwd = await resolveCwd(request);
  const runtime = await getRuntime(cwd);
  return activateSession(runtime, request);
}

async function buildComposerState(runtime: PiRuntime): Promise<ComposerState> {
  const availableModels = (await runtime.session.modelRegistry.getAvailable()).map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: (model.input ?? ["text"]) as Array<"text" | "image">,
  }));

  return {
    currentModel: mapComposerModel(runtime.session.model),
    availableModels,
    currentThinkingLevel: runtime.session.thinkingLevel as ComposerThinkingLevel,
    availableThinkingLevels: mapThinkingLevels(runtime.session.getAvailableThinkingLevels()),
  };
}

function getFirstUserTurnTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  return normalizeThreadTitle(firstUserMessage?.content[0]);
}

function buildLiveThreadData(runtime: PiRuntime): ThreadData | null {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return null;
  }

  const streamMessage = runtime.session.state.streamMessage;
  const sourceMessages = [...runtime.session.messages, ...(streamMessage ? [streamMessage] : [])];
  const messages = sourceMessages
    .map((message, index) => mapRuntimeMessageToUiMessage(message, index))
    .filter((message): message is Message => message !== null);

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount: 0,
    isStreaming: runtime.session.isStreaming,
  };
}

async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return;
  }

  const thread = buildLiveThreadData(runtime);
  if (!thread) {
    return;
  }

  const threadId = runtime.session.sessionId;
  const projectId = runtime.cwd;
  const timestamp = Date.now();
  let hasPersistedSessionFile = false;

  try {
    await stat(sessionPath);
    hasPersistedSessionFile = true;
  } catch {
    hasPersistedSessionFile = false;
  }

  liveThreads.set(sessionPath, thread);
  sessionPathToCwd.set(sessionPath, projectId);

  if (hasPersistedSessionFile) {
    upsertThreadSummary({
      id: threadId,
      cwd: projectId,
      sessionPath,
      title: thread.title,
      lastModifiedMs: timestamp,
    });
    saveThreadCache(sessionPath, thread.title, thread.messages, timestamp);
  }

  emitDesktopEvent({
    type: "thread-update",
    reason,
    projectId,
    threadId,
    sessionPath,
    thread,
    composer: await buildComposerState(runtime),
  });
}

async function createFreshThreadIfNeeded(runtime: PiRuntime) {
  if (runtime.session.messages.length > 0) {
    await runtime.session.newSession();
    if (runtime.session.sessionFile) {
      sessionPathToCwd.set(runtime.session.sessionFile, runtime.cwd);
    }
  }
}

export function subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener);

  return () => {
    desktopListeners.delete(listener);
  };
}

export function getLiveThread(sessionPath: string) {
  return liveThreads.get(sessionPath) ?? null;
}

export async function getComposerState(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const runtime = await getRuntimeForRequest(request);
  if (!runtime.session.isStreaming) {
    await runtime.session.reload();
  }

  const composer = await buildComposerState(runtime);
  emitDesktopEvent({ type: "composer-update", composer });
  return composer;
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  const runtime = await getRuntimeForRequest(request);
  const model = runtime.session.modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
  }

  await runtime.session.setModel(model);
  emitDesktopEvent({ type: "composer-update", composer: await buildComposerState(runtime) });
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const runtime = await getRuntimeForRequest(request);
  runtime.session.setThinkingLevel(level);
  emitDesktopEvent({ type: "composer-update", composer: await buildComposerState(runtime) });
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & { text: string; attachments?: ComposerAttachment[] },
): Promise<void> {
  const runtime = await getRuntimeForRequest(request);
  if (!request.sessionPath) {
    await createFreshThreadIfNeeded(runtime);
  }

  const processedAttachments = await processComposerAttachments(request.attachments ?? []);
  const message = `${request.text}${processedAttachments.text ? `\n\n${processedAttachments.text.trimEnd()}` : ""}`;

  await runtime.session.prompt(message, {
    images: processedAttachments.images,
  });
}

export async function startNewThread(request: ComposerStateRequest = {}): Promise<void> {
  const runtime = await getRuntimeForRequest(request);

  await runtime.session.newSession();

  if (runtime.session.sessionFile) {
    sessionPathToCwd.set(runtime.session.sessionFile, runtime.cwd);
  }

  emitDesktopEvent({
    type: "composer-update",
    composer: await buildComposerState(runtime),
  });
}

export async function selectProjectRuntime(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const runtime = await getRuntimeForRequest({ ...request, sessionPath: null });
  const composer = await buildComposerState(runtime);

  emitDesktopEvent({ type: "composer-update", composer });
  return composer;
}

export async function openThreadRuntime(request: ComposerStateRequest): Promise<ComposerState> {
  const runtime = await getRuntimeForRequest(request);
  const composer = await buildComposerState(runtime);

  emitDesktopEvent({ type: "composer-update", composer });
  return composer;
}
