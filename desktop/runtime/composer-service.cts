import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts";
import { prepareTurnDiffCapture } from "../diff/query";
import { processComposerAttachments } from "./attachments";
import { buildComposerState } from "./composer-state";
import { createFreshThreadIfNeeded, getRuntimeForRequest } from "./runtime-registry";
import { rememberSessionPath } from "./session-path-index";
import { getLiveThread, publishComposerUpdate, subscribeDesktopEvents } from "./thread-publisher";

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

  try {
    await prepareTurnDiffCapture(runtime);
  } catch (error) {
    runtime.pendingTurnCount = null;
    console.warn("Failed to prepare turn diff capture.", error);
  }

  try {
    await runtime.session.prompt(message, {
      images: processedAttachments.images,
    });
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
