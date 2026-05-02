import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { app } from "electron";
import { x as extractTar } from "tar";
import type { AppUpdateState } from "../../../../shared/desktop-app-update-contracts";
import { spawnDetached } from "./spawn-detached";

const APP_NAME = "howcode";
const RELEASE_BASE_URL =
  process.env.HOWCODE_BASE_URL ??
  "https://github.com/IgorWarzocha/howcode/releases/latest/download";
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

type UpdateTarget = {
  os: "macos" | "linux" | "win";
  arch: "arm64" | "x64";
  executable: string;
};

type ReleaseInfo = {
  version: string;
  hash: string;
  assetUrl: string;
};

type InstalledUpdate = ReleaseInfo & {
  executablePath: string;
  installDir: string;
};

type AppUpdaterListener = (state: AppUpdateState) => void;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getTarget(): UpdateTarget {
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  if (!arch) throw new Error(`Unsupported architecture: ${process.arch}`);

  if (process.platform === "darwin") {
    return { os: "macos", arch, executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}` };
  }

  if (process.platform === "linux") {
    return { os: "linux", arch, executable: `${APP_NAME}/${APP_NAME}` };
  }

  if (process.platform === "win32") {
    return { os: "win", arch, executable: `${APP_NAME}/${APP_NAME}.exe` };
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function getCacheRoot() {
  if (process.env.HOWCODE_CACHE_DIR) return process.env.HOWCODE_CACHE_DIR;
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"),
      APP_NAME,
    );
  }
  if (process.platform === "darwin") return path.join(homedir(), "Library", "Caches", APP_NAME);
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"), APP_NAME);
}

function getInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot();
  const releaseKey = `${release.version}-${release.hash}`;
  const installDir = path.join(cacheRoot, "versions", releaseKey);
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, "current.json"),
    installDir,
    executablePath: path.join(installDir, target.executable),
  };
}

async function fetchJson(url: string, timeoutMs = 15_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json() as Promise<unknown>;
}

async function resolveLatestRelease(target: UpdateTarget): Promise<ReleaseInfo> {
  const updateUrl = `${RELEASE_BASE_URL}/stable-${target.os}-${target.arch}-update.json`;
  const metadata = await fetchJson(updateUrl);
  if (!metadata || typeof metadata !== "object")
    throw new Error(`Invalid metadata from ${updateUrl}`);
  const version = "version" in metadata ? metadata.version : null;
  const hash = "hash" in metadata ? metadata.hash : null;
  if (typeof version !== "string" || typeof hash !== "string") {
    throw new Error(`Invalid metadata from ${updateUrl}`);
  }
  return {
    version,
    hash,
    assetUrl: `${RELEASE_BASE_URL}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`,
  };
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body)
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream),
    createWriteStream(filePath),
  );
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

export class AppUpdater {
  private readonly listeners = new Set<AppUpdaterListener>();
  private installedUpdate: InstalledUpdate | null = null;
  private latestRelease: ReleaseInfo | null = null;
  private state: AppUpdateState = {
    status: "idle",
    currentVersion: app.getVersion(),
    latestVersion: null,
    error: null,
  };

  subscribe(listener: AppUpdaterListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  async checkForUpdate() {
    this.setState({ status: "checking", error: null });
    try {
      const target = getTarget();
      const release = await resolveLatestRelease(target);
      this.latestRelease = release;
      const hasUpdate = compareVersions(release.version, this.state.currentVersion) > 0;
      this.setState({
        status: hasUpdate ? "available" : "up-to-date",
        latestVersion: release.version,
        error: null,
      });
    } catch (error) {
      this.setState({ status: "error", error: getErrorMessage(error) });
    }
    return this.state;
  }

  async installUpdate() {
    try {
      const release = this.latestRelease ?? (await this.resolveAvailableRelease());
      this.setState({ status: "downloading", latestVersion: release.version, error: null });
      const target = getTarget();
      const paths = getInstallPaths(target, release);
      if (!existsSync(paths.executablePath)) {
        const tempRoot = path.join(paths.cacheRoot, `.tmp-update-${Date.now()}-${process.pid}`);
        const tempInstallDir = `${paths.installDir}.partial`;
        const archivePath = path.join(tempRoot, `${APP_NAME}-${target.os}-${target.arch}.tar.gz`);
        await rm(tempRoot, { recursive: true, force: true });
        await rm(tempInstallDir, { recursive: true, force: true });
        await mkdir(tempRoot, { recursive: true });
        await downloadFile(release.assetUrl, archivePath);
        const hash = await sha256File(archivePath);
        if (hash !== release.hash)
          throw new Error(
            `Downloaded archive hash mismatch. Expected ${release.hash}, got ${hash}.`,
          );
        this.setState({ status: "installing", latestVersion: release.version, error: null });
        await mkdir(tempInstallDir, { recursive: true });
        await extractTar({ file: archivePath, cwd: tempInstallDir });
        if (!existsSync(path.join(tempInstallDir, target.executable))) {
          throw new Error(`Downloaded archive did not contain ${target.executable}.`);
        }
        await rm(paths.installDir, { recursive: true, force: true });
        await mkdir(path.dirname(paths.installDir), { recursive: true });
        await rename(tempInstallDir, paths.installDir);
        await rm(tempRoot, { recursive: true, force: true });
      }

      await writeFile(
        paths.currentFile,
        JSON.stringify(
          {
            version: release.version,
            hash: release.hash,
            installDir: paths.installDir,
            executablePath: paths.executablePath,
          },
          null,
          2,
        ),
      );
      this.installedUpdate = {
        ...release,
        executablePath: paths.executablePath,
        installDir: paths.installDir,
      };
      this.setState({ status: "ready", latestVersion: release.version, error: null });
    } catch (error) {
      this.setState({ status: "error", error: getErrorMessage(error) });
    }
    return this.state;
  }

  async restartToUpdate() {
    if (!this.installedUpdate) return this.state;
    this.setState({ status: "restarting", error: null });
    spawnDetached(this.installedUpdate.executablePath);
    app.quit();
    return this.state;
  }

  private async resolveAvailableRelease() {
    await this.checkForUpdate();
    if (!this.latestRelease || this.state.status !== "available") {
      throw new Error("No update is available.");
    }
    return this.latestRelease;
  }

  private setState(nextState: Partial<AppUpdateState>) {
    this.state = { ...this.state, ...nextState };
    for (const listener of this.listeners) listener(this.state);
  }
}
