import fs from "node:fs";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { applyHeadlessPiTheme } from "./headless-pi-theme.cts";

const howcodeExtensionErrorMessageType = "howcode.extension.error";
const extensionCommandCancelledResult = { cancelled: true };
const runnersWithHowcodeContextFilter = new WeakSet<object>();
const runnersWithCommandAbort = new WeakSet<object>();
const activeExtensionCommands = new WeakMap<
  AgentSession,
  { commandName: string; abortController: AbortController }
>();

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
  onExtensionCommandStateChange?: () => void;
};

export function isHeadlessExtensionCommandRunning(session: AgentSession) {
  return activeExtensionCommands.has(session);
}

export function abortHeadlessExtensionCommand(session: AgentSession) {
  const activeCommand = activeExtensionCommands.get(session);
  if (!activeCommand) return false;
  activeCommand.abortController.abort();
  return true;
}

function isHowcodeExtensionErrorMessage(message: AgentMessage) {
  return (
    message.role === "custom" &&
    "customType" in message &&
    message.customType === howcodeExtensionErrorMessageType
  );
}

function bindHowcodeContextFilter(session: AgentSession) {
  const extensionRunner = session.extensionRunner;
  if (runnersWithHowcodeContextFilter.has(extensionRunner)) return;
  runnersWithHowcodeContextFilter.add(extensionRunner);

  const originalEmitContext = extensionRunner.emitContext.bind(extensionRunner);
  extensionRunner.emitContext = async (messages: AgentMessage[]) => {
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
  options: HeadlessAgentSessionExtensionOptions,
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
    reload: async () => {
      await session.reload();
      await refreshHeadlessAgentSessionExtensionBindings(session, options);
    },
  };
}

function bindHeadlessCommandAbort(
  session: AgentSession,
  options: HeadlessAgentSessionExtensionOptions,
) {
  const extensionRunner = session.extensionRunner;
  if (runnersWithCommandAbort.has(extensionRunner)) return;
  runnersWithCommandAbort.add(extensionRunner);

  const originalGetCommand = extensionRunner.getCommand.bind(extensionRunner);
  type ExtensionCommand = NonNullable<ReturnType<typeof originalGetCommand>>;
  type ExtensionCommandContext = Parameters<ExtensionCommand["handler"]>[1];

  extensionRunner.getCommand = (name: string) => {
    const command = originalGetCommand(name);
    if (!command) return command;

    return {
      ...command,
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        const abortController = new AbortController();
        activeExtensionCommands.set(session, { commandName: name, abortController });
        options.onExtensionCommandStateChange?.();
        Object.defineProperty(ctx, "signal", {
          configurable: true,
          get: () => abortController.signal,
        });
        ctx.abort = () => abortController.abort();

        try {
          await command.handler?.(args, ctx);
        } finally {
          if (activeExtensionCommands.get(session)?.abortController === abortController) {
            activeExtensionCommands.delete(session);
            options.onExtensionCommandStateChange?.();
          }
        }
      },
    };
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

export async function refreshHeadlessAgentSessionExtensionBindings(
  session: AgentSession,
  options: HeadlessAgentSessionExtensionOptions = {},
) {
  bindHowcodeContextFilter(session);
  bindHeadlessCommandAbort(session, options);
  await applyHeadlessPiTheme(session).catch((error) => {
    console.warn("Failed to initialize headless Pi theme", error);
  });
}

export async function bindHeadlessAgentSessionExtensions(
  session: AgentSession,
  options: HeadlessAgentSessionExtensionOptions = {},
) {
  await refreshHeadlessAgentSessionExtensionBindings(session, options);
  await session.bindExtensions({
    commandContextActions: createHeadlessCommandContextActions(session, options),
    shutdownHandler: () => undefined,
    onError: (error) => {
      void reportHeadlessExtensionError(session, error, options);
    },
  });
  await refreshHeadlessAgentSessionExtensionBindings(session, options);
}
