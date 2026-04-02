import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.js";
import { processComposerAttachments } from "./attachments.cjs";
import { buildComposerState } from "./composer-state.cjs";
import { createFreshThreadIfNeeded, getRuntimeForRequest } from "./runtime-registry.cjs";
import { rememberSessionPath } from "./session-path-index.cjs";
import {
  getLiveThread,
  publishComposerUpdate,
  subscribeDesktopEvents,
} from "./thread-publisher.cjs";

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const runtime = await getRuntimeForRequest(request);
  const composer = await buildComposerState(runtime);
  publishComposerUpdate(composer);

  return {
    composer,
    runtime,
  };
}

export { getLiveThread, subscribeDesktopEvents };

export async function getComposerState(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const runtime = await getRuntimeForRequest(request);
  if (!runtime.session.isStreaming) {
    await runtime.session.reload();
  }

  const composer = await buildComposerState(runtime);
  publishComposerUpdate(composer);
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
  return emitComposerUpdate(request);
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const runtime = await getRuntimeForRequest(request);
  runtime.session.setThinkingLevel(level);
  return emitComposerUpdate(request);
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & { text: string; attachments?: ComposerAttachment[] },
): Promise<void> {
  const runtime = await getRuntimeForRequest(request);
  if (!request.sessionPath) {
    await createFreshThreadIfNeeded(runtime);
  }

  const processedAttachments = await processComposerAttachments(request.attachments ?? []);
  if (
    processedAttachments.images.length > 0 &&
    runtime.session.model &&
    !runtime.session.model.input?.includes("image")
  ) {
    throw new Error(
      `${runtime.session.model.name ?? runtime.session.model.id} does not support image attachments.`,
    );
  }

  const message = `${request.text}${processedAttachments.text ? `\n\n${processedAttachments.text.trimEnd()}` : ""}`;

  await runtime.session.prompt(message, {
    images: processedAttachments.images,
  });
}

export async function startNewThread(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const runtime = await getRuntimeForRequest(request);
  await runtime.session.newSession();
  rememberSessionPath(runtime.session.sessionFile, runtime.cwd);

  const composer = await buildComposerState(runtime);
  publishComposerUpdate(composer);
  return composer;
}

export async function selectProjectRuntime(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const { composer } = await emitComposerUpdate({ ...request, sessionPath: null });
  return composer;
}

export async function openThreadRuntime(request: ComposerStateRequest): Promise<ComposerState> {
  const { composer } = await emitComposerUpdate(request);
  return composer;
}
