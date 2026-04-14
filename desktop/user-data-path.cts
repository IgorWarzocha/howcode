import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Utils } from "electrobun/bun";

type VersionInfo = {
  identifier: string;
  channel: string;
};

const fallbackVersionInfo: VersionInfo = {
  identifier: "howcode.desktop.local",
  channel: process.env.NODE_ENV === "development" ? "dev" : "",
};

let cachedUserDataPath: string | null = null;

function getAppDataDirectory() {
  switch (process.platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support");
    case "win32":
      return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    default:
      return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  }
}

function readVersionInfo(versionJsonPath: string): VersionInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(versionJsonPath, "utf-8")) as {
      identifier?: unknown;
      channel?: unknown;
    };

    return typeof parsed.identifier === "string" && typeof parsed.channel === "string"
      ? { identifier: parsed.identifier, channel: parsed.channel }
      : null;
  } catch {
    return null;
  }
}

function getBundledVersionInfo() {
  const launcherDir = path.dirname(process.argv0 || process.execPath);
  const candidates = [
    path.join(launcherDir, "..", "Resources", "version.json"),
    path.join(path.dirname(process.execPath), "..", "Resources", "version.json"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const versionInfo = readVersionInfo(candidate);
    if (versionInfo) {
      return versionInfo;
    }
  }

  return fallbackVersionInfo;
}

export function getDesktopUserDataPath() {
  if (cachedUserDataPath) {
    return cachedUserDataPath;
  }

  try {
    const userDataPath = Utils.paths.userData;
    if (userDataPath) {
      cachedUserDataPath = userDataPath;
      return userDataPath;
    }
  } catch {
    // Electrobun resolves this from a relative version.json path, which is unreliable when the
    // runtime cwd is nested under Resources/app/.... Fall back to an absolute bundle lookup.
  }

  const { identifier, channel } = getBundledVersionInfo();
  cachedUserDataPath = channel
    ? path.join(getAppDataDirectory(), identifier, channel)
    : path.join(getAppDataDirectory(), identifier);
  return cachedUserDataPath;
}
