import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, type ViteDevServer } from "vite";

import {
  DEV_SERVER_HOST,
  DEV_SERVER_METADATA_RELATIVE_PATH,
  DEV_SERVER_START_PORT,
} from "../shared/dev-server";

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;
const devServerMetadataPath = path.join(projectRoot, DEV_SERVER_METADATA_RELATIVE_PATH);
const bridgeBuildPath = path.join(projectRoot, "build", "dev-web-bridge.mjs");
const bridgeToken = crypto.randomUUID();

let bridge: { child: ChildProcess; port: number } | null = null;
let server: ViteDevServer | null = null;
let isShuttingDown = false;
let trustedRendererHost: string | null = null;

async function buildDevWebBridge() {
  await mkdir(path.dirname(bridgeBuildPath), { recursive: true });
  const result = await Bun.build({
    entrypoints: [path.join(projectRoot, "scripts", "dev-web-bridge-node.ts")],
    outdir: path.dirname(bridgeBuildPath),
    naming: path.basename(bridgeBuildPath),
    target: "node",
    format: "esm",
    packages: "external",
    sourcemap: "linked",
    throw: true,
  });

  console.log(`Built dev:web bridge (${result.outputs.length} output(s)).`);
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    bridge?.child.kill();
    await removeDevServerMetadata();
    await server?.close();
  } finally {
    process.exit(exitCode);
  }
}

async function startDevWebBridge() {
  await buildDevWebBridge();

  const child = spawn(electronPath, [bridgeBuildPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOWCODE_REPO_ROOT: process.env.HOWCODE_REPO_ROOT || projectRoot,
      HOWCODE_DEV_WEB_BRIDGE_HOST: DEV_SERVER_HOST,
      HOWCODE_DEV_WEB_BRIDGE_PORT: "0",
      HOWCODE_DEV_WEB_BRIDGE_TOKEN: bridgeToken,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return new Promise<{ child: ChildProcess; port: number }>((resolve, reject) => {
    let stdoutBuffer = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    child.once("error", fail);
    child.once("exit", (code, signal) => {
      if (!settled) {
        fail(new Error(`dev:web bridge exited before startup (code=${code}, signal=${signal}).`));
        return;
      }

      console.error(`dev:web bridge exited unexpectedly (code=${code}, signal=${signal}).`);
      void shutdown(1);
    });

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutBuffer += text;
      process.stdout.write(text);

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("HOWCODE_DEV_WEB_BRIDGE_READY ")) {
          continue;
        }

        const payload = JSON.parse(line.slice("HOWCODE_DEV_WEB_BRIDGE_READY ".length)) as {
          port?: number;
        };
        if (typeof payload.port !== "number") {
          fail(new Error("dev:web bridge reported an invalid port."));
          return;
        }

        settled = true;
        resolve({ child, port: payload.port });
        return;
      }
    });
  });
}

function proxyDevWebBridgeRequest(
  bridgePort: number,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const proxyRequest = http.request(
    {
      hostname: DEV_SERVER_HOST,
      port: bridgePort,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        "x-howcode-dev-web-bridge-token": bridgeToken,
      },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.headers);
      proxyResponse.pipe(response);
      response.on("close", () => {
        if (!proxyResponse.destroyed) {
          proxyResponse.destroy();
        }
      });
    },
  );

  proxyRequest.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message }));
  });

  request.on("close", () => {
    if (!request.complete) {
      proxyRequest.destroy();
    }
  });

  request.pipe(proxyRequest);
}

function isTrustedBrowserRequest(request: http.IncomingMessage) {
  if (!trustedRendererHost || request.headers.host !== trustedRendererHost) {
    return false;
  }

  const origin = request.headers.origin;
  if (typeof origin !== "string") {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === trustedRendererHost;
  } catch {
    return false;
  }
}

async function writeDevServerMetadata(url: string, port: number) {
  await mkdir(path.dirname(devServerMetadataPath), { recursive: true });
  await writeFile(
    devServerMetadataPath,
    JSON.stringify(
      {
        host: DEV_SERVER_HOST,
        port,
        url,
      },
      null,
      2,
    ),
  );
}

async function removeDevServerMetadata() {
  await rm(devServerMetadataPath, { force: true });
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
process.once("exit", () => {
  bridge?.child.kill();
  try {
    rmSync(devServerMetadataPath, { force: true });
  } catch {
    // Best-effort cleanup during process exit.
  }
});

try {
  bridge = await startDevWebBridge();

  server = await createServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    server: {
      host: DEV_SERVER_HOST,
      port: DEV_SERVER_START_PORT,
      strictPort: false,
    },
  });

  const bridgeMiddleware = (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    next: () => void,
  ) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (requestUrl.pathname === "/__howcode/config") {
      if (!isTrustedBrowserRequest(request)) {
        response.statusCode = 403;
        response.end("Forbidden");
        return;
      }

      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ bridgeToken }));
      return;
    }

    if (
      requestUrl.pathname.startsWith("/__howcode/events") ||
      requestUrl.pathname.startsWith("/__howcode/request/")
    ) {
      if (!isTrustedBrowserRequest(request)) {
        response.statusCode = 403;
        response.end("Forbidden");
        return;
      }

      proxyDevWebBridgeRequest(bridge?.port ?? 0, request, response);
      return;
    }

    next();
  };

  (
    server.middlewares as unknown as {
      stack: Array<{ route: string; handle: typeof bridgeMiddleware }>;
    }
  ).stack.unshift({
    route: "",
    handle: bridgeMiddleware,
  });

  const listenPromise = server.listen();
  let listenError: unknown = null;

  void listenPromise.catch((error) => {
    listenError = error;
  });

  while (!server.httpServer?.listening) {
    if (listenError) {
      throw listenError;
    }

    await delay(25);
  }

  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Vite did not expose a numeric dev-server port.");
  }

  const { port } = address as AddressInfo;
  trustedRendererHost = `${DEV_SERVER_HOST}:${port}`;
  await writeDevServerMetadata(`http://${DEV_SERVER_HOST}:${port}`, port);
  server.printUrls();
  console.warn(
    "\n[howcode] dev:web local desktop bridge is enabled for project sync/import. `bun run dev` remains the preferred full desktop dev loop.\n",
  );
  await listenPromise;
} catch (error) {
  bridge?.child.kill();
  await removeDevServerMetadata();
  throw error;
}
