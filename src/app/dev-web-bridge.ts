import type { DesktopAction } from "../../shared/desktop-actions";
import type {
  AnyDesktopActionPayload,
  ComposerAttachment,
  DesktopEvent,
} from "../../shared/desktop-contracts";
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from "../../shared/desktop-ipc";
import type { TerminalEvent, TerminalOpenRequest } from "../../shared/terminal-contracts";

let bridgeTokenPromise: Promise<string> | null = null;

function getBridgeToken() {
  bridgeTokenPromise ??= fetch("/__howcode/config")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load dev:web bridge config.");
      }
      return response.json() as Promise<{ bridgeToken?: string }>;
    })
    .then((config) => {
      if (!config.bridgeToken) {
        throw new Error("dev:web bridge config did not include a token.");
      }
      return config.bridgeToken;
    })
    .catch((error) => {
      bridgeTokenPromise = null;
      throw error;
    });

  return bridgeTokenPromise;
}

async function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]["params"],
) {
  const bridgeToken = await getBridgeToken();
  const response = await fetch(`/__howcode/request/${channel}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-howcode-dev-web-bridge-token": bridgeToken,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Desktop bridge request failed: ${channel}`);
  }

  return (await response.json()) as DesktopRequestMap[K]["response"];
}

type EventSubscription = {
  eventSource: EventSource;
  listeners: Set<(event: MessageEvent<string>) => void>;
};

const eventSubscriptions = new Map<DesktopEventChannel, EventSubscription>();

function getEventSubscription(channel: DesktopEventChannel) {
  const current = eventSubscriptions.get(channel);
  if (current) {
    return current;
  }

  const subscription: EventSubscription = {
    eventSource: new EventSource(`/__howcode/events/${channel}`),
    listeners: new Set(),
  };
  eventSubscriptions.set(channel, subscription);
  return subscription;
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const subscription = getEventSubscription(channel);
  const wrappedListener = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as {
      channel: K;
      event: DesktopEventMap[K];
    };
    listener(payload.event);
  };

  subscription.listeners.add(wrappedListener);
  subscription.eventSource.addEventListener(channel, wrappedListener);
  return () => {
    subscription.eventSource.removeEventListener(channel, wrappedListener);
    subscription.listeners.delete(wrappedListener);
    if (subscription.listeners.size === 0) {
      subscription.eventSource.close();
      eventSubscriptions.delete(channel);
    }
  };
}

export function installDevWebDesktopBridge() {
  if (window.piDesktop) {
    return;
  }

  window.__howcodeDevWebBridge = true;

  window.piDesktop = {
    getShellState: () => invokeRequest("getShellState", {}),
    getProjectGitState: (projectId: string) => invokeRequest("getProjectGitState", { projectId }),
    getProjectDiff: (projectId: string, baseline = null) =>
      invokeRequest("getProjectDiff", { projectId, baseline }),
    getProjectDiffStats: (projectId: string, baseline = null) =>
      invokeRequest("getProjectDiffStats", { projectId, baseline }),
    captureProjectDiffBaseline: (projectId: string) =>
      invokeRequest("captureProjectDiffBaseline", { projectId }),
    listProjectCommits: (projectId: string, limit: number | null = null) =>
      invokeRequest("listProjectCommits", { projectId, limit }),
    searchPiPackages: (request = {}) => invokeRequest("searchPiPackages", request),
    getConfiguredPiPackages: (request = {}) => invokeRequest("getConfiguredPiPackages", request),
    installPiPackage: (request) => invokeRequest("installPiPackage", request),
    removePiPackage: (request) => invokeRequest("removePiPackage", request),
    searchPiSkills: (request = {}) => invokeRequest("searchPiSkills", request),
    getConfiguredPiSkills: (request = {}) => invokeRequest("getConfiguredPiSkills", request),
    installPiSkill: (request) => invokeRequest("installPiSkill", request),
    removePiSkill: (request) => invokeRequest("removePiSkill", request),
    startSkillCreatorSession: (request) => invokeRequest("startSkillCreatorSession", request),
    continueSkillCreatorSession: (request) => invokeRequest("continueSkillCreatorSession", request),
    closeSkillCreatorSession: (sessionId: string) =>
      invokeRequest("closeSkillCreatorSession", { sessionId }),
    pickComposerAttachments: () => Promise.resolve([] satisfies ComposerAttachment[]),
    readClipboardSnapshot: (formats: string[] | null = null) =>
      invokeRequest("readClipboardSnapshot", { formats }),
    readClipboardFilePaths: () => invokeRequest("readClipboardFilePaths", {}),
    getAttachmentKindsForPaths: (paths: string[]) =>
      invokeRequest("getAttachmentKindsForPaths", { paths }),
    getPathForFile: () => null,
    listComposerAttachmentEntries: (request = {}) =>
      invokeRequest("listComposerAttachmentEntries", request),
    getComposerState: (request = {}) => invokeRequest("getComposerState", request),
    getComposerSlashCommands: (request = {}) => invokeRequest("getComposerSlashCommands", request),
    getDictationState: () => invokeRequest("getDictationState", {}),
    listDictationModels: () => invokeRequest("listDictationModels", {}),
    installDictationModel: (modelId: "tiny.en" | "base.en" | "small.en") =>
      invokeRequest("installDictationModel", { modelId }),
    removeDictationModel: (modelId: "tiny.en" | "base.en" | "small.en") =>
      invokeRequest("removeDictationModel", { modelId }),
    transcribeDictation: (request) => invokeRequest("transcribeDictation", request),
    getProjectThreads: (projectId: string) => invokeRequest("getProjectThreads", { projectId }),
    getInboxThreads: () => invokeRequest("getInboxThreads", {}),
    getArchivedThreads: () => invokeRequest("getArchivedThreads", {}),
    getThread: (sessionPath: string, historyCompactions = 0) =>
      invokeRequest("getThread", { sessionPath, historyCompactions }),
    watchSession: async (sessionPath: string | null) => {
      await invokeRequest("watchSession", { sessionPath });
    },
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      invokeRequest("invokeAction", { action, payload }),
    listTerminals: () => invokeRequest("listTerminals", {}),
    openTerminal: (request: TerminalOpenRequest) => invokeRequest("terminalOpen", request),
    writeTerminal: async (sessionId: string, data: string) => {
      await invokeRequest("terminalWrite", { sessionId, data });
    },
    resizeTerminal: async (request) => {
      await invokeRequest("terminalResize", request);
    },
    closeTerminal: async (request) => {
      await invokeRequest("terminalClose", request);
    },
    statTerminalSessionFile: (sessionId: string) =>
      invokeRequest("terminalSessionFileStat", { sessionId }),
    getTerminalStatus: (sessionId: string) => invokeRequest("terminalStatus", { sessionId }),
    openExternal: (url: string) => invokeRequest("openExternal", { url }).then(({ ok }) => ok),
    openPath: (path: string) => invokeRequest("openPath", { path }).then(({ ok }) => ok),
    subscribe: (listener: (event: DesktopEvent) => void) =>
      subscribeToEvent("desktopEvent", listener),
    subscribeTerminal: (listener: (event: TerminalEvent) => void) =>
      subscribeToEvent("terminalEvent", listener),
  };
}
