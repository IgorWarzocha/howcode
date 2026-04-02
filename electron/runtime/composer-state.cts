import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type {
  ComposerModel,
  ComposerState,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.js";
import type { PiRuntime } from "./types.cjs";

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

export async function buildComposerState(runtime: PiRuntime): Promise<ComposerState> {
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
