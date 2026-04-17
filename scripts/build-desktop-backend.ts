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

function patchBundledPiExtensionLoader(source: string) {
  // Pi's extension loader switches to virtualModules only for Bun compiled binaries.
  // Our desktop backend is bundled into standalone .mjs files instead, which means the
  // loader's filesystem alias fallbacks point at nonexistent package paths in release builds.
  // Allow the desktop runtime to force virtualModules when running the bundled backend.
  return source.replace(
    /\.\.\.isBunBinary\s*\?\s*\{\s*virtualModules:\s*VIRTUAL_MODULES,\s*tryNative:\s*false\s*\}\s*:\s*\{\s*alias:\s*getAliases\(\)\s*\}/g,
    '...(isBunBinary || process.env.HOWCODE_FORCE_PI_VIRTUAL_MODULES === "1") ? { virtualModules: VIRTUAL_MODULES, tryNative: false } : { alias: getAliases() }',
  );
}

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

    if (output.path.endsWith(".map")) {
      await Bun.write(targetPath, output);
      continue;
    }

    const text = await output.text();
    await Bun.write(targetPath, patchBundledPiExtensionLoader(text));
  }
}
