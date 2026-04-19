import path from "node:path";
import { createRequire } from "node:module";
import { app } from "electron";

const require = createRequire(__filename);

function resolvePiPackageDirectory() {
  try {
    return path.dirname(require.resolve("@mariozechner/pi-coding-agent/package.json"));
  } catch {
    return null;
  }
}

function resolveConfiguredUserDataPath() {
  const configuredUserDataPath = process.env.HOWCODE_USER_DATA_PATH?.trim();
  if (configuredUserDataPath) {
    return configuredUserDataPath;
  }

  const defaultUserDataPath = app.getPath("userData");
  return app.isPackaged ? defaultUserDataPath : path.join(defaultUserDataPath, "dev");
}

export function configureDesktopEnvironment() {
  const userDataPath = resolveConfiguredUserDataPath();
  app.setPath("userData", userDataPath);
  process.env.HOWCODE_USER_DATA_PATH = userDataPath;

  const piPackageDirectory = resolvePiPackageDirectory();
  if (piPackageDirectory) {
    process.env.PI_PACKAGE_DIR = piPackageDirectory;
  }
}
