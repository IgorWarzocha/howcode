import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const appName = "howcode";

const electronOutputRoot = path.join(process.cwd(), "artifacts", "electron");
const artifactRoot = path.join(process.cwd(), "artifacts");
const launcherOutputRoot = path.join(artifactRoot, "npm-launcher");

type Target = {
  os: "macos" | "linux" | "win";
  arch: "arm64" | "x64";
};

function getCurrentTarget(): Target {
  if (process.platform === "darwin") {
    return { os: "macos", arch: process.arch === "arm64" ? "arm64" : "x64" };
  }

  if (process.platform === "win32") {
    return { os: "win", arch: "x64" };
  }

  return { os: "linux", arch: process.arch === "arm64" ? "arm64" : "x64" };
}

async function findPaths(rootPath: string, matcher: (entryPath: string) => boolean) {
  const stack = [rootPath];
  const matches: string[] = [];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (matcher(entryPath)) {
        matches.push(entryPath);
      }

      if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    }
  }

  return matches;
}

async function resolveBundlePath(target: Target) {
  if (!existsSync(electronOutputRoot)) {
    throw new Error("Missing Electron output. Run `bun run build:release` first.");
  }

  const matches = await findPaths(electronOutputRoot, (entryPath) => {
    const normalized = entryPath.replace(/\\/g, "/");
    if (target.os === "macos") {
      return normalized.endsWith(`/${appName}.app`);
    }

    if (target.os === "win") {
      return /win.*unpacked$/i.test(path.basename(entryPath));
    }

    return /linux.*unpacked$/i.test(path.basename(entryPath));
  });

  const [bundlePath] = matches.sort((left, right) => left.length - right.length);
  if (!bundlePath) {
    throw new Error(`Could not find unpacked Electron bundle in ${electronOutputRoot}.`);
  }

  return bundlePath;
}

async function createNormalizedArchive(bundlePath: string, target: Target) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `${appName}-${target.os}-${target.arch}-`));
  const normalizedBundleName = target.os === "macos" ? `${appName}.app` : appName;
  const normalizedBundlePath = path.join(tempRoot, normalizedBundleName);
  const archivePath = path.join(
    launcherOutputRoot,
    `${appName}-${target.os}-${target.arch}.tar.gz`,
  );

  await cp(bundlePath, normalizedBundlePath, { recursive: true });

  const tarResult = spawnSync("tar", ["-czf", archivePath, "-C", tempRoot, normalizedBundleName], {
    stdio: "inherit",
  });

  await rm(tempRoot, { recursive: true, force: true });

  if (tarResult.status !== 0) {
    throw new Error(`Failed to package launcher archive for ${target.os}-${target.arch}.`);
  }

  return archivePath;
}

async function createUpdateMetadata(archivePath: string, target: Target, version: string) {
  const archiveBuffer = await readFile(archivePath);
  const hash = createHash("sha256").update(archiveBuffer).digest("hex");
  const metadataPath = path.join(artifactRoot, `stable-${target.os}-${target.arch}-update.json`);

  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        version,
        hash,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const packageJson = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { version: string };
  mkdirSync(launcherOutputRoot, { recursive: true });
  const target = getCurrentTarget();
  const bundlePath = await resolveBundlePath(target);
  const archivePath = await createNormalizedArchive(bundlePath, target);
  await createUpdateMetadata(archivePath, target, packageJson.version);
  console.log(`created ${path.relative(process.cwd(), archivePath)}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
