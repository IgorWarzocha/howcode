import type {
  RuntimeHostRequestMessage,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
} from "./protocol.cts";
import {
  dequeueComposerPrompt,
  getComposerSlashCommands,
  getComposerState,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  setRuntimeHostEventSink,
  stopComposerRun,
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

process.on("message", (message: RuntimeHostRequestMessage) => {
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

process.on("uncaughtException", (error) => {
  process.send?.({
    type: "host-error",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});

process.on("unhandledRejection", (error) => {
  process.send?.({
    type: "host-error",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});
