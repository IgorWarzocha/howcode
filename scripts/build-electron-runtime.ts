import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const isWatchMode = process.argv.includes("--watch");
const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, "build");

const buildTargets = [
  {
    label: "electron-runtime",
    entrypoints: [
      path.join(projectRoot, "src", "electron", "main", "index.ts"),
      path.join(projectRoot, "src", "electron", "preload", "index.ts"),
    ],
    outdir: path.join(buildRoot, "electron"),
    root: path.join(projectRoot, "src", "electron"),
    naming: {
      entry: "[dir]/[name].cjs",
    },
    format: "cjs",
  },
  {
    label: "desktop-runtime",
    entrypoints: [
      path.join(projectRoot, "desktop", "pi-threads.cts"),
      path.join(projectRoot, "desktop", "pi-skills.cts"),
      path.join(projectRoot, "desktop", "skill-creator-session.cts"),
    ],
    outdir: path.join(buildRoot, "desktop"),
    root: path.join(projectRoot, "desktop"),
    naming: {
      entry: "[name].mjs",
    },
    format: "esm",
  },
  {
    label: "terminal-manager",
    entrypoints: [path.join(projectRoot, "desktop", "terminal", "manager.cts")],
    outdir: path.join(buildRoot, "desktop"),
    root: path.join(projectRoot, "desktop", "terminal"),
    naming: {
      entry: "terminal-manager.mjs",
    },
    format: "esm",
  },
] as const;

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, "electron"), { recursive: true, force: true });
  await rm(path.join(buildRoot, "desktop"), { recursive: true, force: true });
  await mkdir(path.join(buildRoot, "electron"), { recursive: true });
  await mkdir(path.join(buildRoot, "desktop"), { recursive: true });
}

async function runBuild() {
  await prepareBuildDirectories();

  const builds = await Promise.all(
    buildTargets.map((target) =>
      Bun.build({
        entrypoints: [...target.entrypoints],
        outdir: target.outdir,
        root: target.root,
        naming: target.naming,
        target: "node",
        format: target.format,
        packages: "external",
        sourcemap: "linked",
        watch: isWatchMode,
        throw: true,
      } as Bun.BuildConfig & { watch?: boolean }),
    ),
  );

  for (const [index, build] of builds.entries()) {
    console.log(`Built ${buildTargets[index].label} (${build.outputs.length} output(s)).`);
  }

  if (isWatchMode) {
    console.log("Watching Electron runtime bundles...");
    await new Promise(() => {
      setInterval(() => {}, 1 << 30);
    });
  }
}

void runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
