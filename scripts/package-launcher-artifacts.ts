import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const appName = "howcode";
const buildRoot = path.join(process.cwd(), "build");
const outputRoot = path.join(process.cwd(), "artifacts", "npm-launcher");

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

  const archivePath = path.join(outputRoot, `${appName}-${target.os}-${target.arch}.tar.gz`);
  const result = spawnSync("tar", ["-czf", archivePath, "-C", buildDir, bundleName], {
    stdio: "inherit",
  });

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
