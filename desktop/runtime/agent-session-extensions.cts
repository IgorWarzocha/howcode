import fs from "node:fs";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { applyHeadlessPiTheme } from "./headless-pi-theme.cts";

const howcodeExtensionErrorMessageType = "howcode.extension.error";
const extensionCommandCancelledResult = { cancelled: true };
const sessionsWithHowcodeContextFilter = new WeakSet<AgentSession>();

type ExtensionBindings = Parameters<AgentSession["bindExtensions"]>[0];
type ExtensionCommandContextActions = NonNullable<ExtensionBindings["commandContextActions"]>;
type ResourceExtensionPaths = Parameters<AgentSession["resourceLoader"]["extendResources"]>[0];

type ExtensionResourceEntry = { path: string; extensionPath: string };

function findPackageName(startPath: string) {
  let directory =
    fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
      ? startPath
      : path.dirname(startPath);

  while (true) {
    const packageJsonPath = path.join(directory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
        if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
          return parsed.name;
        }
      } catch {
        return null;
      }
    }

    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function getExtensionDisplayLabel(extensionPath: string) {
  if (extensionPath.startsWith("command:")) {
    return `/${extensionPath.slice("command:".length)}`;
  }

  if (extensionPath.startsWith("<")) {
    return extensionPath.replace(/[<>]/g, "");
  }

  const packageName = findPackageName(extensionPath);
  if (packageName) return packageName;

  return path.basename(extensionPath).replace(/\.(ts|js)$/, "");
}

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

type HeadlessAgentSessionExtensionOptions = {
  onExtensionError?: (error: Parameters<NonNullable<ExtensionBindings["onError"]>>[0]) => void;
};

function isHowcodeExtensionErrorMessage(message: AgentMessage) {
  return (
    message.role === "custom" &&
    "customType" in message &&
    message.customType === howcodeExtensionErrorMessageType
  );
}

function bindHowcodeContextFilter(session: AgentSession) {
  if (sessionsWithHowcodeContextFilter.has(session)) return;
  sessionsWithHowcodeContextFilter.add(session);

  const originalEmitContext = session.extensionRunner.emitContext.bind(session.extensionRunner);
  session.extensionRunner.emitContext = async (messages: AgentMessage[]) => {
    const nextMessages = await originalEmitContext(messages);
    return nextMessages.filter((message) => !isHowcodeExtensionErrorMessage(message));
  };
}

async function reportHeadlessExtensionError(
  session: AgentSession,
  error: Parameters<NonNullable<ExtensionBindings["onError"]>>[0],
  options: HeadlessAgentSessionExtensionOptions = {},
) {
  console.warn("Pi extension error", error);
  const extensionLabel = getExtensionDisplayLabel(error.extensionPath);
  try {
    await session.sendCustomMessage(
      {
        customType: howcodeExtensionErrorMessageType,
        content: `${extensionLabel} extension error: ${error.error}`,
        display: true,
        details: { ...error, extensionLabel },
      },
      { triggerTurn: false },
    );
  } catch (messageError) {
    console.warn("Failed to surface Pi extension error in session", messageError);
  }
  options.onExtensionError?.(error);
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
  await applyHeadlessPiTheme(session);
}

export async function bindHeadlessAgentSessionExtensions(
  session: AgentSession,
  options: HeadlessAgentSessionExtensionOptions = {},
) {
  bindHowcodeContextFilter(session);
  await applyHeadlessPiTheme(session);
  await session.bindExtensions({
    commandContextActions: createHeadlessCommandContextActions(session),
    shutdownHandler: () => undefined,
    onError: (error) => {
      void reportHeadlessExtensionError(session, error, options);
    },
  });
  await applyHeadlessPiTheme(session);
}
