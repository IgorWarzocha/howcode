import { rmSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "vite";

import {
  DEV_SERVER_HOST,
  DEV_SERVER_METADATA_RELATIVE_PATH,
  DEV_SERVER_START_PORT,
} from "../shared/dev-server";

const devServerMetadataPath = path.join(process.cwd(), DEV_SERVER_METADATA_RELATIVE_PATH);

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

const server = await createServer({
  configFile: path.join(process.cwd(), "vite.config.ts"),
  server: {
    host: DEV_SERVER_HOST,
    port: DEV_SERVER_START_PORT,
    strictPort: false,
  },
});

let isShuttingDown = false;

async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    await removeDevServerMetadata();
    await server.close();
  } finally {
    process.exit(exitCode);
  }
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
process.once("exit", () => {
  try {
    rmSync(devServerMetadataPath, { force: true });
  } catch {
    // Best-effort cleanup during process exit.
  }
});

try {
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
  await writeDevServerMetadata(`http://${DEV_SERVER_HOST}:${port}`, port);
  server.printUrls();
  await listenPromise;
} catch (error) {
  await removeDevServerMetadata();
  throw error;
}
