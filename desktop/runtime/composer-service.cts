import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { prepareTurnDiffCapture } from "../diff/query.cts";
import { buildComposerAttachmentPrompt } from "./attachments.cts";
import { buildComposerState } from "./composer-state.cts";
import { createFreshThreadIfNeeded, getRuntimeForRequest } from "./runtime-registry.cts";
import { rememberSessionPath } from "./session-path-index.cts";
import {
  getLiveThread,
  publishComposerUpdate,
  subscribeDesktopEvents,
} from "./thread-publisher.cts";

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

  // Reads should reflect the current in-memory runtime state. Reloading or publishing here can
  // race with just-applied composer mutations and re-broadcast stale snapshots back into the UI.
  return await buildComposerState(runtime);
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

  const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
  const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;

  try {
    await prepareTurnDiffCapture(runtime);
  } catch (error) {
    runtime.pendingTurnCount = null;
    console.warn("Failed to prepare turn diff capture.", error);
  }

  try {
    await runtime.session.prompt(message);
  } catch (error) {
    runtime.pendingTurnCount = null;
    throw error;
  }
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
