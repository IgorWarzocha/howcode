import { mkdirSync } from "node:fs";
import path from "node:path";

const outputDir = path.join(process.cwd(), "build", "electron");
mkdirSync(outputDir, { recursive: true });

const builds = [
  {
    entrypoint: path.join(process.cwd(), "electron", "pi-threads.cts"),
    outfile: path.join(outputDir, "pi-threads.mjs"),
  },
  {
    entrypoint: path.join(process.cwd(), "electron", "terminal", "manager.cts"),
    outfile: path.join(outputDir, "terminal-manager.mjs"),
  },
];

for (const build of builds) {
  const result = await Bun.build({
    entrypoints: [build.entrypoint],
    outfile: build.outfile,
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    external: ["@mariozechner/pi-coding-agent"],
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    process.exit(1);
  }
}
