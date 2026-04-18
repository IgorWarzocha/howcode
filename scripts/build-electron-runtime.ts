import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { build, context, type BuildOptions } from "esbuild";

const isWatchMode = process.argv.includes("--watch");
const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, "build");

const commonOptions: Pick<
  BuildOptions,
  "bundle" | "platform" | "target" | "sourcemap" | "packages" | "logLevel"
> = {
  bundle: true,
  platform: "node",
  target: "node24",
  sourcemap: true,
  packages: "external" as const,
  logLevel: "info" as const,
};

const electronOptions: BuildOptions = {
  ...commonOptions,
  format: "cjs" as const,
  entryPoints: [
    path.join(projectRoot, "src", "electron", "main", "index.ts"),
    path.join(projectRoot, "src", "electron", "preload", "index.ts"),
  ],
  outbase: path.join(projectRoot, "src", "electron"),
  outdir: path.join(buildRoot, "electron"),
  external: ["electron"],
  outExtension: {
    ".js": ".cjs",
  },
};

const desktopOptions: BuildOptions = {
  ...commonOptions,
  format: "esm" as const,
  entryPoints: {
    "pi-threads": path.join(projectRoot, "desktop", "pi-threads.cts"),
    "pi-skills": path.join(projectRoot, "desktop", "pi-skills.cts"),
    "skill-creator-session": path.join(projectRoot, "desktop", "skill-creator-session.cts"),
    "terminal-manager": path.join(projectRoot, "desktop", "terminal", "manager.cts"),
  },
  outdir: path.join(buildRoot, "desktop"),
  outExtension: {
    ".js": ".mjs",
  },
};

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, "electron"), { recursive: true, force: true });
  await rm(path.join(buildRoot, "desktop"), { recursive: true, force: true });
  await mkdir(path.join(buildRoot, "electron"), { recursive: true });
  await mkdir(path.join(buildRoot, "desktop"), { recursive: true });
}

async function runBuild() {
  await prepareBuildDirectories();

  if (isWatchMode) {
    const [electronContext, desktopContext] = await Promise.all([
      context(electronOptions),
      context(desktopOptions),
    ]);

    await Promise.all([electronContext.watch(), desktopContext.watch()]);
    console.log("Watching Electron runtime bundles...");
    return;
  }

  await Promise.all([build(electronOptions), build(desktopOptions)]);
}

void runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
