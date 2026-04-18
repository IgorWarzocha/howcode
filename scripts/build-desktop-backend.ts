import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const outputDir = path.join(process.cwd(), "build", "desktop");
mkdirSync(outputDir, { recursive: true });

const builds = [
  {
    entrypoint: path.join(process.cwd(), "desktop", "pi-threads.cts"),
    outfile: path.join(outputDir, "pi-threads.mjs"),
    piLoaderPatch: "required",
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "pi-skills.cts"),
    outfile: path.join(outputDir, "pi-skills.mjs"),
    piLoaderPatch: "absent",
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "skill-creator-session.cts"),
    outfile: path.join(outputDir, "skill-creator-session.mjs"),
    piLoaderPatch: "required",
  },
  {
    entrypoint: path.join(process.cwd(), "desktop", "terminal", "manager.cts"),
    outfile: path.join(outputDir, "terminal-manager.mjs"),
    piLoaderPatch: "absent",
  },
];

const PI_EXTENSION_LOADER_PATTERN =
  /\.\.\.isBunBinary\s*\?\s*\{\s*virtualModules:\s*VIRTUAL_MODULES,\s*tryNative:\s*false\s*\}\s*:\s*\{\s*alias:\s*getAliases\(\)\s*\}/g;

const EXTERNAL_DESKTOP_PACKAGES = ["sherpa-onnx-node"];

function patchBundledPiExtensionLoader(source: string) {
  // Pi's extension loader switches to virtualModules only for Bun compiled binaries.
  // Our desktop backend is bundled into standalone .mjs files instead, which means the
  // loader's filesystem alias fallbacks point at nonexistent package paths in release builds.
  // Allow the desktop runtime to force virtualModules when running the bundled backend.
  let replacements = 0;
  const patchedSource = source.replace(PI_EXTENSION_LOADER_PATTERN, () => {
    replacements += 1;

    return '...(isBunBinary || process.env.HOWCODE_FORCE_PI_VIRTUAL_MODULES === "1") ? { virtualModules: VIRTUAL_MODULES, tryNative: false } : { alias: getAliases() }';
  });

  return { patchedSource, replacements };
}

for (const build of builds) {
  rmSync(build.outfile, { force: true });
  rmSync(`${build.outfile}.map`, { force: true });

  const result = await Bun.build({
    entrypoints: [build.entrypoint],
    target: "bun",
    format: "esm",
    external: EXTERNAL_DESKTOP_PACKAGES,
    // We post-process the bundles that carry Pi's extension loader. Disable linked sourcemaps for
    // those outputs so we never ship stale mappings after rewriting the emitted JavaScript.
    sourcemap: build.piLoaderPatch === "required" ? "none" : "linked",
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
    const { patchedSource, replacements } = patchBundledPiExtensionLoader(text);

    if (build.piLoaderPatch === "required" && replacements === 0) {
      throw new Error(
        `Expected to patch Pi's extension loader in ${path.basename(build.outfile)}, but the emitted bundle no longer matched the known pattern.`,
      );
    }

    if (build.piLoaderPatch === "absent" && replacements > 0) {
      throw new Error(
        `Unexpected Pi extension loader patch match in ${path.basename(build.outfile)}. Review the bundle layout before silently rewriting it.`,
      );
    }

    await Bun.write(targetPath, patchedSource);
  }
}
