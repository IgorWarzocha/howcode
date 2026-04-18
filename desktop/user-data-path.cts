import os from "node:os";
import path from "node:path";

type VersionInfo = {
  identifier: string;
  channel: string;
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

function getBundledVersionInfo(): VersionInfo {
  return {
    identifier: process.env.HOWCODE_APP_ID || "howcode.desktop.local",
    channel: process.env.HOWCODE_CHANNEL || (process.env.NODE_ENV === "development" ? "dev" : ""),
  };
}

export function getDesktopUserDataPath() {
  if (cachedUserDataPath) {
    return cachedUserDataPath;
  }

  const configuredUserDataPath = process.env.HOWCODE_USER_DATA_PATH?.trim();
  if (configuredUserDataPath) {
    cachedUserDataPath = configuredUserDataPath;
    return configuredUserDataPath;
  }

  const { identifier, channel } = getBundledVersionInfo();
  cachedUserDataPath = channel
    ? path.join(getAppDataDirectory(), identifier, channel)
    : path.join(getAppDataDirectory(), identifier);
  return cachedUserDataPath;
}
