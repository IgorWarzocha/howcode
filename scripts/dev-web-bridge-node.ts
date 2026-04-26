import { stat } from "node:fs/promises";
import http from "node:http";

import { getAttachmentKind, isSafeExternalUrl } from "../shared/composer-attachments";
import { getDesktopWorkingDirectory } from "../shared/desktop-working-directory";
import type {
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestHandlerMap,
} from "../shared/desktop-ipc";
import { listComposerAttachmentEntries } from "../src/desktop-host/composer-attachments";
import * as piThreads from "../desktop/pi-threads.cts";
import * as piSkills from "../desktop/pi-skills.cts";
import * as skillCreator from "../desktop/skill-creator-session.cts";
import * as terminalManager from "../desktop/terminal/manager.cts";
import { openPathWithSystem } from "../desktop/system-open-path.cts";

const host = process.env.HOWCODE_DEV_WEB_BRIDGE_HOST || "127.0.0.1";
const port = Number(process.env.HOWCODE_DEV_WEB_BRIDGE_PORT || 0);
const bridgeToken = process.env.HOWCODE_DEV_WEB_BRIDGE_TOKEN || "";

const desktopEventClients = new Set<http.ServerResponse>();
const terminalEventClients = new Set<http.ServerResponse>();
const sseClients = new Set<http.ServerResponse>();

function sendSseEvent<TChannel extends keyof DesktopEventMap>(
  clients: Set<http.ServerResponse>,
  channel: TChannel,
  event: DesktopEventMap[TChannel],
) {
  const payload = JSON.stringify({ channel, event });
  for (const client of clients) {
    client.write(`event: ${channel}\n`);
    client.write(`data: ${payload}\n\n`);
  }
}

piThreads.subscribeDesktopEvents((event) => {
  sendSseEvent(desktopEventClients, "desktopEvent", event);
});
terminalManager.subscribeTerminalEvents((event) => {
  sendSseEvent(terminalEventClients, "terminalEvent", event);
});

const handlers: DesktopRequestHandlerMap = {
  getShellState: () => piThreads.loadShellState(getDesktopWorkingDirectory()),
  getProjectGitState: ({ projectId }) => piThreads.loadProjectGitState(projectId),
  getProjectDiff: ({ projectId, baseline }) =>
    piThreads.loadProjectDiff(projectId, baseline ?? null),
  getProjectDiffStats: ({ projectId, baseline }) =>
    piThreads.loadProjectDiffStats(projectId, baseline ?? null),
  captureProjectDiffBaseline: ({ projectId }) => piThreads.captureProjectDiffBaseline(projectId),
  listProjectCommits: ({ projectId, limit }) =>
    piThreads.listProjectCommits(projectId, limit ?? null),
  searchPiPackages: (request) => piThreads.searchPiPackages(request),
  getConfiguredPiPackages: (request) => piThreads.listConfiguredPiPackages(request),
  installPiPackage: (request) => piThreads.installPiPackage(request),
  removePiPackage: (request) => piThreads.removePiPackage(request),
  searchPiSkills: (request) => piSkills.searchPiSkills(request),
  getConfiguredPiSkills: (request) => piSkills.listConfiguredPiSkills(request),
  installPiSkill: (request) => piSkills.installPiSkill(request),
  removePiSkill: (request) => piSkills.removePiSkill(request),
  startSkillCreatorSession: (request) => skillCreator.startSkillCreatorSession(request),
  continueSkillCreatorSession: (request) => skillCreator.continueSkillCreatorSession(request),
  closeSkillCreatorSession: (request) => skillCreator.closeSkillCreatorSession(request),
  pickComposerAttachments: () => [],
  readClipboardSnapshot: () => ({ formats: [], valuesByFormat: {} }),
  readClipboardFilePaths: () => ({ filePaths: [], text: null }),
  getAttachmentKindsForPaths: async ({ paths }) => {
    const uniquePaths = [...new Set(Array.isArray(paths) ? paths : [])].filter(
      (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
    );
    const entries = await Promise.all(
      uniquePaths.map(async (candidate) => {
        try {
          const stats = await stat(candidate);
          return [
            candidate,
            stats.isDirectory() ? "directory" : getAttachmentKind(candidate),
          ] as const;
        } catch {
          return [candidate, null] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  },
  listComposerAttachmentEntries: (request) => listComposerAttachmentEntries(request),
  getComposerState: (request) => piThreads.loadComposerState(request),
  getComposerSlashCommands: (request) => piThreads.loadComposerSlashCommands(request),
  getDictationState: () => piThreads.getDictationState(),
  listDictationModels: () => piThreads.listDictationModels(),
  installDictationModel: (request) => piThreads.installDictationModel(request),
  removeDictationModel: (request) => piThreads.removeDictationModel(request),
  transcribeDictation: (request) => piThreads.transcribeDictation(request),
  getProjectThreads: ({ projectId }) => piThreads.loadProjectThreads(projectId),
  getInboxThreads: () => piThreads.loadInboxThreadList(),
  getArchivedThreads: () => piThreads.loadArchivedThreadList(),
  getThread: ({ sessionPath, historyCompactions = 0 }) =>
    piThreads.loadThread(sessionPath, { historyCompactions }),
  watchSession: async ({ sessionPath }) => {
    await piThreads.setWatchedSessionPath(sessionPath);
    return { ok: true };
  },
  invokeAction: async ({ action, payload = {} }) => {
    try {
      const result = await piThreads.handleDesktopAction(action, payload);
      return {
        ok: true,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: result ?? null,
      };
    } catch (error) {
      console.error("dev:web invokeAction failed", { action, payload, error });
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: error instanceof Error ? error.message : "Desktop action failed unexpectedly.",
        },
      };
    }
  },
  listTerminals: () => terminalManager.listTerminals(),
  terminalOpen: (request) => terminalManager.openTerminal(request),
  terminalWrite: async ({ sessionId, data }) => {
    await terminalManager.writeTerminal(sessionId, data);
    return { ok: true };
  },
  terminalResize: async ({ sessionId, cols, rows }) => {
    await terminalManager.resizeTerminal(sessionId, cols, rows);
    return { ok: true };
  },
  terminalClose: async (request) => {
    await terminalManager.closeTerminal(request);
    return { ok: true };
  },
  openExternal: async ({ url }) => ({
    ok: isSafeExternalUrl(url) && (await openPathWithSystem(url)),
  }),
  openPath: async ({ path: targetPath }) => ({ ok: await openPathWithSystem(targetPath) }),
};

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function handleBridgeRequest(
  channel: DesktopRequestChannel,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const handler = handlers[channel];
  if (!handler) {
    sendJson(response, 404, { error: `Unknown desktop request channel: ${channel}` });
    return;
  }

  try {
    const params = await readJsonBody(request);
    const result = await (handler as (params: unknown) => Promise<unknown> | unknown)(params);
    sendJson(response, 200, result ?? null);
  } catch (error) {
    console.error("dev:web bridge request failed", { channel, error });
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Desktop bridge request failed.",
    });
  }
}

function hasValidBridgeToken(request: http.IncomingMessage) {
  return (
    bridgeToken.length > 0 && request.headers["x-howcode-dev-web-bridge-token"] === bridgeToken
  );
}

function handleBridgeEvents(
  channel: keyof DesktopEventMap,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  response.write("retry: 1000\n\n");

  const clients = channel === "terminalEvent" ? terminalEventClients : desktopEventClients;
  clients.add(response);
  sseClients.add(response);
  request.on("close", () => {
    clients.delete(response);
    sseClients.delete(response);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}`);

  if (!hasValidBridgeToken(request)) {
    sendJson(response, 403, { error: "Invalid dev:web bridge token." });
    return;
  }

  if (requestUrl.pathname.startsWith("/__howcode/events/")) {
    const channel = requestUrl.pathname.slice("/__howcode/events/".length);
    if (channel !== "desktopEvent" && channel !== "terminalEvent") {
      sendJson(response, 404, { error: `Unknown desktop event channel: ${channel}` });
      return;
    }

    handleBridgeEvents(channel, request, response);
    return;
  }

  if (requestUrl.pathname.startsWith("/__howcode/request/")) {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Desktop bridge requests must use POST." });
      return;
    }

    const channel = requestUrl.pathname.slice("/__howcode/request/".length);
    void handleBridgeRequest(channel as DesktopRequestChannel, request, response);
    return;
  }

  sendJson(response, 404, { error: "Unknown dev:web bridge endpoint." });
});

server.listen(port, host, () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("dev:web bridge did not expose a numeric port.");
  }

  console.log(`HOWCODE_DEV_WEB_BRIDGE_READY ${JSON.stringify({ host, port: address.port })}`);
});

function shutdown() {
  for (const client of sseClients) {
    client.end();
    client.destroy();
  }
  sseClients.clear();
  desktopEventClients.clear();
  terminalEventClients.clear();

  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 750).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
