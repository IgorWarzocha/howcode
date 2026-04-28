import path from "node:path";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

const extensionCommandCancelledResult = { cancelled: true };

type ExtensionBindings = Parameters<AgentSession["bindExtensions"]>[0];
type ExtensionCommandContextActions = NonNullable<ExtensionBindings["commandContextActions"]>;
type ResourceExtensionPaths = Parameters<AgentSession["resourceLoader"]["extendResources"]>[0];

type ExtensionResourceEntry = { path: string; extensionPath: string };

function getExtensionSourceLabel(extensionPath: string) {
  if (extensionPath.startsWith("<")) {
    return `extension:${extensionPath.replace(/[<>]/g, "")}`;
  }

  return `extension:${path.basename(extensionPath).replace(/\.(ts|js)$/, "")}`;
}

function buildExtensionResourcePaths(entries: ExtensionResourceEntry[]) {
  return entries.map((entry) => {
    const source = getExtensionSourceLabel(entry.extensionPath);
    const baseDir = entry.extensionPath.startsWith("<")
      ? undefined
      : path.dirname(entry.extensionPath);

    return {
      path: entry.path,
      metadata: {
        source,
        scope: "temporary" as const,
        origin: "top-level" as const,
        baseDir,
      },
    };
  });
}

async function reportHeadlessExtensionError(
  session: AgentSession,
  error: Parameters<NonNullable<ExtensionBindings["onError"]>>[0],
) {
  console.warn("Pi extension error", error);
  await session.sendCustomMessage({
    customType: "howcode.extension.error",
    content: `Extension error (${error.extensionPath}): ${error.error}`,
    display: true,
    details: error,
  });
}

function createHeadlessCommandContextActions(
  session: AgentSession,
): ExtensionCommandContextActions {
  return {
    waitForIdle: () => session.agent.waitForIdle(),
    newSession: async () => extensionCommandCancelledResult,
    fork: async () => extensionCommandCancelledResult,
    navigateTree: async (targetId, options) => {
      const result = await session.navigateTree(targetId, {
        summarize: options?.summarize,
        customInstructions: options?.customInstructions,
        replaceInstructions: options?.replaceInstructions,
        label: options?.label,
      });
      return { cancelled: result.cancelled };
    },
    switchSession: async () => extensionCommandCancelledResult,
    reload: () => session.reload(),
  };
}

export async function discoverHeadlessAgentSessionResources(session: AgentSession) {
  if (!session.extensionRunner.hasHandlers("resources_discover")) {
    return;
  }

  const { skillPaths, promptPaths, themePaths } =
    await session.extensionRunner.emitResourcesDiscover(session.sessionManager.getCwd(), "startup");

  if (skillPaths.length === 0 && promptPaths.length === 0 && themePaths.length === 0) {
    return;
  }

  const extensionPaths: ResourceExtensionPaths = {
    skillPaths: buildExtensionResourcePaths(skillPaths),
    promptPaths: buildExtensionResourcePaths(promptPaths),
    themePaths: buildExtensionResourcePaths(themePaths),
  };
  session.resourceLoader.extendResources(extensionPaths);
}

export async function bindHeadlessAgentSessionExtensions(session: AgentSession) {
  await session.bindExtensions({
    commandContextActions: createHeadlessCommandContextActions(session),
    shutdownHandler: () => undefined,
    onError: (error) => {
      void reportHeadlessExtensionError(session, error).catch((reportError) => {
        console.warn("Could not report Pi extension error", reportError);
      });
    },
  });
}
