const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

const packageJson = require("../package.json");

const APP_NAME = packageJson.howcode.appName;
const RELEASE_BASE_URL = process.env.HOWCODE_BASE_URL || packageJson.howcode.releaseBaseUrl;

const TARGETS = {
  "darwin:arm64": {
    os: "macos",
    arch: "arm64",
    executable: `${APP_NAME}.app/Contents/MacOS/launcher`,
  },
  "darwin:x64": {
    os: "macos",
    arch: "x64",
    executable: `${APP_NAME}.app/Contents/MacOS/launcher`,
  },
  "linux:arm64": {
    os: "linux",
    arch: "arm64",
    executable: `${APP_NAME}/bin/launcher`,
  },
  "linux:x64": {
    os: "linux",
    arch: "x64",
    executable: `${APP_NAME}/bin/launcher`,
  },
  "win32:arm64": {
    os: "win",
    arch: "x64",
    executable: `${APP_NAME}/bin/launcher.exe`,
  },
  "win32:x64": {
    os: "win",
    arch: "x64",
    executable: `${APP_NAME}/bin/launcher.exe`,
  },
};

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getTarget() {
  const key = `${process.platform}:${process.arch}`;
  const target = TARGETS[key];
  if (!target) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
  }
  return target;
}

function getCacheRoot() {
  if (process.env.HOWCODE_CACHE_DIR) {
    return process.env.HOWCODE_CACHE_DIR;
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      APP_NAME,
    );
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", APP_NAME);
  }

  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), APP_NAME);
}

function getPaths(target, releaseInfo) {
  const cacheRoot = getCacheRoot();
  const versionsRoot = path.join(cacheRoot, "versions");
  const releaseKey = `${releaseInfo.version}-${releaseInfo.hash}`;
  const installDir = path.join(versionsRoot, releaseKey);
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, "current.json"),
    installDir,
    executablePath: path.join(installDir, target.executable),
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadFile(url, filePath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} while downloading ${url}`);
    }

    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveLatestRelease(target) {
  const updateUrl = `${RELEASE_BASE_URL}/stable-${target.os}-${target.arch}-update.json`;
  const metadata = await fetchJson(updateUrl);
  if (!metadata || typeof metadata.version !== "string" || typeof metadata.hash !== "string") {
    throw new Error(`Invalid release metadata from ${updateUrl}`);
  }

  return {
    version: metadata.version,
    hash: metadata.hash,
    assetUrl: `${RELEASE_BASE_URL}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`,
  };
}

async function installRelease(target, releaseInfo, paths) {
  const tempRoot = path.join(paths.cacheRoot, `.tmp-${Date.now()}-${process.pid}`);
  const tempInstallDir = `${paths.installDir}.partial`;
  const archivePath = path.join(tempRoot, `${APP_NAME}-${target.os}-${target.arch}.tar.gz`);

  console.log(`Downloading ${APP_NAME} ${releaseInfo.version} for ${target.os}-${target.arch}...`);

  await fsp.rm(tempRoot, { recursive: true, force: true });
  await fsp.rm(tempInstallDir, { recursive: true, force: true });
  await fsp.mkdir(tempRoot, { recursive: true });
  await fsp.mkdir(path.dirname(paths.installDir), { recursive: true });
  await downloadFile(releaseInfo.assetUrl, archivePath);
  await fsp.mkdir(tempInstallDir, { recursive: true });

  const extract = spawnSync("tar", ["-xzf", archivePath, "-C", tempInstallDir], {
    stdio: "inherit",
  });

  if (extract.status !== 0) {
    throw new Error("Failed to extract downloaded archive with `tar -xzf`.");
  }

  if (!fs.existsSync(path.join(tempInstallDir, target.executable))) {
    throw new Error(`Downloaded archive did not contain ${target.executable}.`);
  }

  await fsp.rm(paths.installDir, { recursive: true, force: true });
  await fsp.rename(tempInstallDir, paths.installDir);
  await fsp.rm(tempRoot, { recursive: true, force: true });

  await fsp.writeFile(
    paths.currentFile,
    JSON.stringify(
      {
        version: releaseInfo.version,
        hash: releaseInfo.hash,
        installDir: paths.installDir,
        executablePath: paths.executablePath,
      },
      null,
      2,
    ),
  );
}

async function pruneOldVersions(cacheRoot, keepDir) {
  const versionsRoot = path.join(cacheRoot, "versions");
  let entries = [];

  try {
    entries = await fsp.readdir(versionsRoot, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsRoot, entry.name))
      .filter((dirPath) => dirPath !== keepDir)
      .map((dirPath) => fsp.rm(dirPath, { recursive: true, force: true })),
  );
}

function launch(executablePath) {
  const child = spawn(executablePath, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: path.dirname(executablePath),
  });

  child.unref();
}

async function main() {
  const target = getTarget();
  const cacheRoot = getCacheRoot();
  await fsp.mkdir(cacheRoot, { recursive: true });

  const current = readJsonIfPresent(path.join(cacheRoot, "current.json"));

  let releaseInfo = null;
  try {
    releaseInfo = await resolveLatestRelease(target);
  } catch (error) {
    if (current?.executablePath && fs.existsSync(current.executablePath)) {
      launch(current.executablePath);
      return;
    }

    throw error;
  }

  const paths = getPaths(target, releaseInfo);
  if (!fs.existsSync(paths.executablePath)) {
    await installRelease(target, releaseInfo, paths);
  }

  await pruneOldVersions(cacheRoot, paths.installDir);
  launch(paths.executablePath);
}

module.exports = {
  main: async () => {
    try {
      await main();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`howcode: ${message}`);
      process.exit(1);
    }
  },
};

if (require.main === module) {
  module.exports.main();
}
