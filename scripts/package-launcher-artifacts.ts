import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const appName = "howcode";
const buildRoot = path.join(process.cwd(), "build");
const outputRoot = path.join(process.cwd(), "artifacts", "npm-launcher");

function getElectrobunZstdPath() {
  const electrobunRoot = path.join(process.cwd(), "node_modules", "electrobun");
  const targetOs =
    process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux";
  const targetArch = process.arch === "arm64" ? "arm64" : "x64";
  const binExt = process.platform === "win32" ? ".exe" : "";

  return path.join(electrobunRoot, `dist-${targetOs}-${targetArch}`, `zig-zstd${binExt}`);
}

function getBundleZstdPath(bundlePath: string) {
  const binaryName = process.platform === "win32" ? "zig-zstd.exe" : "zig-zstd";

  if (process.platform === "darwin") {
    return path.join(bundlePath, "Contents", "MacOS", binaryName);
  }

  return path.join(bundlePath, "bin", binaryName);
}

function resolveZstdPath(bundlePath: string) {
  const candidates = [getBundleZstdPath(bundlePath), getElectrobunZstdPath()];
  const foundPath = candidates.find((candidatePath) => existsSync(candidatePath));

  if (!foundPath) {
    throw new Error(`Unable to find zig-zstd. Checked: ${candidates.join(", ")}`);
  }

  return foundPath;
}

const targets = [
  { os: "macos", arch: "arm64" },
  { os: "macos", arch: "x64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "arm64" },
  { os: "win", arch: "x64" },
] as const;

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

let packagedCount = 0;

for (const target of targets) {
  const buildDir = path.join(buildRoot, `stable-${target.os}-${target.arch}`);
  const bundleName = target.os === "macos" ? `${appName}.app` : appName;
  const bundlePath = path.join(buildDir, bundleName);

  if (!existsSync(bundlePath)) {
    continue;
  }

  const metadataPath = path.join(bundlePath, "Resources", "metadata.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as { hash?: string };
  if (!metadata.hash) {
    throw new Error(`Missing release hash in ${metadataPath}.`);
  }

  const payloadPath = path.join(bundlePath, "Resources", `${metadata.hash}.tar.zst`);
  if (!existsSync(payloadPath)) {
    throw new Error(`Missing packaged payload for ${target.os}-${target.arch}: ${payloadPath}`);
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), `${appName}-${target.os}-${target.arch}-`));
  const zstdPath = resolveZstdPath(bundlePath);
  const tarPath = path.join(tempRoot, `${appName}-${target.os}-${target.arch}.tar`);
  const decompressResult = spawnSync(
    zstdPath,
    ["decompress", "-i", payloadPath, "-o", tarPath, "--no-timing"],
    {
      stdio: "inherit",
    },
  );

  if (decompressResult.status !== 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`Failed to decompress payload for ${target.os}-${target.arch}.`);
  }

  const extractResult = spawnSync("tar", ["-xf", tarPath, "-C", tempRoot], {
    stdio: "inherit",
  });

  if (extractResult.status !== 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`Failed to extract payload for ${target.os}-${target.arch}.`);
  }

  const extractedBundlePath = path.join(tempRoot, bundleName);
  if (!existsSync(extractedBundlePath)) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`Extracted payload missing ${bundleName} for ${target.os}-${target.arch}.`);
  }

  const archivePath = path.join(outputRoot, `${appName}-${target.os}-${target.arch}.tar.gz`);
  const result = spawnSync("tar", ["-czf", archivePath, "-C", tempRoot, bundleName], {
    stdio: "inherit",
  });

  rmSync(tempRoot, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(`Failed to create launcher archive for ${target.os}-${target.arch}.`);
  }

  console.log(`created ${path.relative(process.cwd(), archivePath)}`);
  packagedCount += 1;
}

if (packagedCount === 0) {
  throw new Error(
    "No stable Electrobun bundles were found under build/. Run `bun run build:release` first.",
  );
}

console.log(
  `packaged ${packagedCount} launcher archive(s) into ${path.relative(process.cwd(), outputRoot)}`,
);
