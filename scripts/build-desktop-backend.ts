import { mkdirSync } from "node:fs";
import path from "node:path";

const outputDir = path.join(process.cwd(), "build", "desktop");
mkdirSync(outputDir, { recursive: true });

const builds = [
  {
    entrypoint: path.join(process.cwd(), "desktop", "pi-threads.cts"),
    outfile: path.join(outputDir, "pi-threads.mjs"),
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "pi-skills.cts"),
    outfile: path.join(outputDir, "pi-skills.mjs"),
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "skill-creator-session.cts"),
    outfile: path.join(outputDir, "skill-creator-session.mjs"),
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "terminal", "manager.cts"),
    outfile: path.join(outputDir, "terminal-manager.mjs"),
  },
];

for (const build of builds) {
  const result = await Bun.build({
    entrypoints: [build.entrypoint],
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    throw: false,
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    process.exit(1);
  }

  for (const output of result.outputs) {
    const targetPath = output.path.endsWith(".map") ? `${build.outfile}.map` : build.outfile;
    await Bun.write(targetPath, output);
  }
}
