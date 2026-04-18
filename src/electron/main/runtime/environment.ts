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

export function configureDesktopEnvironment() {
  process.env.HOWCODE_USER_DATA_PATH = app.getPath("userData");

  const piPackageDirectory = resolvePiPackageDirectory();
  if (piPackageDirectory) {
    process.env.PI_PACKAGE_DIR = piPackageDirectory;
  }
}
