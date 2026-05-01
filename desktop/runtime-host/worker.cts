import type {
  RuntimeMainToHostMessage,
  RuntimeHostRequestMessage,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
} from "./protocol.cts";
import { handleMainResponse } from "./main-request-client.cts";
import {
  dequeueComposerPrompt,
  disposeAllRuntimeHosts,
  getComposerSlashCommands,
  generateGitCommitMessage,
  getComposerState,
  getPiSessionStorage,
  invalidateRuntimeSettings,
  installPiPackage,
  installPiSkill,
  listConfiguredPiPackages,
  listConfiguredPiSkills,
  loadPiSettings,
  loadThreadSnapshot,
  openThreadRuntime,
  selectProjectRuntime,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  setRuntimeHostEventSink,
  closeSkillCreatorSession,
  continueSkillCreatorSession,
  startNewThread,
  startSkillCreatorSession,
  stopComposerRun,
  removePiPackage,
  removePiSkill,
  updatePiSetting,
} from "./host-service.cts";

setRuntimeHostEventSink((event) => {
  process.send?.({ type: "desktop-event", event });
});

async function handleRequest<TName extends RuntimeHostRequestName>(
  message: RuntimeHostRequestMessage<TName>,
): Promise<RuntimeHostResponseMap[TName]> {
  switch (message.name) {
    case "getComposerState": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"getComposerState">["payload"];
      return (await getComposerState(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "getComposerSlashCommands": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"getComposerSlashCommands">["payload"];
      return (await getComposerSlashCommands(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "startNewThread": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"startNewThread">["payload"];
      return (await startNewThread(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "selectProjectRuntime": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"selectProjectRuntime">["payload"];
      return (await selectProjectRuntime(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "openThreadRuntime": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"openThreadRuntime">["payload"];
      return (await openThreadRuntime(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "invalidateRuntimeSettings": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"invalidateRuntimeSettings">["payload"];
      return (await invalidateRuntimeSettings(payload)) as RuntimeHostResponseMap[TName];
    }
    case "getPiSessionStorage": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"getPiSessionStorage">["payload"];
      return (await getPiSessionStorage(payload.projectPath)) as RuntimeHostResponseMap[TName];
    }
    case "loadPiSettings": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"loadPiSettings">["payload"];
      return (await loadPiSettings(payload.projectPath)) as RuntimeHostResponseMap[TName];
    }
    case "updatePiSetting": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"updatePiSetting">["payload"];
      return (await updatePiSetting(
        payload.key,
        payload.value,
        payload.projectPath,
      )) as RuntimeHostResponseMap[TName];
    }
    case "listConfiguredPiPackages": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"listConfiguredPiPackages">["payload"];
      return (await listConfiguredPiPackages(payload)) as RuntimeHostResponseMap[TName];
    }
    case "listConfiguredPiSkills": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"listConfiguredPiSkills">["payload"];
      return (await listConfiguredPiSkills(payload)) as RuntimeHostResponseMap[TName];
    }
    case "installPiSkill": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"installPiSkill">["payload"];
      return (await installPiSkill(payload)) as RuntimeHostResponseMap[TName];
    }
    case "removePiSkill": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"removePiSkill">["payload"];
      return (await removePiSkill(payload)) as RuntimeHostResponseMap[TName];
    }
    case "installPiPackage": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"installPiPackage">["payload"];
      return (await installPiPackage(payload)) as RuntimeHostResponseMap[TName];
    }
    case "removePiPackage": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"removePiPackage">["payload"];
      return (await removePiPackage(payload)) as RuntimeHostResponseMap[TName];
    }
    case "loadThreadSnapshot": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"loadThreadSnapshot">["payload"];
      return (await loadThreadSnapshot(payload)) as RuntimeHostResponseMap[TName];
    }
    case "startSkillCreatorSession": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"startSkillCreatorSession">["payload"];
      return (await startSkillCreatorSession(payload)) as RuntimeHostResponseMap[TName];
    }
    case "continueSkillCreatorSession": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"continueSkillCreatorSession">["payload"];
      return (await continueSkillCreatorSession(payload)) as RuntimeHostResponseMap[TName];
    }
    case "closeSkillCreatorSession": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"closeSkillCreatorSession">["payload"];
      return (await closeSkillCreatorSession(payload)) as RuntimeHostResponseMap[TName];
    }
    case "generateGitCommitMessage": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"generateGitCommitMessage">["payload"];
      return (await generateGitCommitMessage(
        payload.request,
        payload.context,
      )) as RuntimeHostResponseMap[TName];
    }
    case "setComposerModel": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"setComposerModel">["payload"];
      return (await setComposerModel(
        payload.request,
        payload.provider,
        payload.modelId,
      )) as RuntimeHostResponseMap[TName];
    }
    case "setComposerThinkingLevel": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"setComposerThinkingLevel">["payload"];
      return (await setComposerThinkingLevel(
        payload.request,
        payload.level,
      )) as RuntimeHostResponseMap[TName];
    }
    case "sendComposerPrompt": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"sendComposerPrompt">["payload"];
      return (await sendComposerPrompt(payload)) as RuntimeHostResponseMap[TName];
    }
    case "stopComposerRun": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"stopComposerRun">["payload"];
      return (await stopComposerRun(payload.request)) as RuntimeHostResponseMap[TName];
    }
    case "dequeueComposerPrompt": {
      const payload =
        message.payload as unknown as RuntimeHostRequestMessage<"dequeueComposerPrompt">["payload"];
      return (await dequeueComposerPrompt(payload)) as RuntimeHostResponseMap[TName];
    }
    default:
      throw new Error(
        `Unknown runtime host request: ${(message as RuntimeHostRequestMessage).name}`,
      );
  }
}

process.on("message", (message: RuntimeMainToHostMessage) => {
  if (message && message.type === "main-response") {
    handleMainResponse(message);
    return;
  }
  if (!message || message.type !== "request") {
    return;
  }

  void handleRequest(message)
    .then((result) => {
      process.send?.({ type: "response", id: message.id, ok: true, result });
    })
    .catch((error) => {
      process.send?.({
        type: "response",
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
});

function reportFatalHostError(error: unknown) {
  process.send?.(
    {
      type: "host-error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    () => {
      process.exit(1);
    },
  );
  setTimeout(() => process.exit(1), 100).unref();
}

process.on("uncaughtException", reportFatalHostError);

process.on("unhandledRejection", (error) => {
  process.send?.({
    type: "host-error",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});

let isShuttingDown = false;

async function shutdownRuntimeHost() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    await disposeAllRuntimeHosts();
  } finally {
    process.exit(0);
  }
}

process.once("disconnect", () => {
  void shutdownRuntimeHost();
});

process.once("SIGTERM", () => {
  void shutdownRuntimeHost();
});

process.once("SIGINT", () => {
  void shutdownRuntimeHost();
});
