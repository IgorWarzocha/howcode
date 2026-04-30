import type { ReactArtifactCompileResult } from "../shared/desktop-contracts.ts";

export async function compileReactArtifact(source: string): Promise<ReactArtifactCompileResult> {
  try {
    const esbuild = await import("esbuild");
    const result = await esbuild.build({
      stdin: {
        contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import Artifact from "artifact:source";
      const rootElement = document.getElementById("root");
      if (!rootElement) throw new Error("Artifact preview root missing");
      if (typeof Artifact !== "function") throw new Error("React artifact default export must be a component function.");
      createRoot(rootElement).render(React.createElement(Artifact));
    `,
        loader: "tsx",
        resolveDir: process.cwd(),
        sourcefile: "artifact-preview-entry.tsx",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2020",
      jsx: "automatic",
      logLevel: "silent",
      treeShaking: true,
      plugins: [
        {
          name: "artifact-source",
          setup(build) {
            build.onResolve({ filter: /^artifact:source$/ }, (args) => ({
              path: args.path,
              namespace: "artifact-source",
            }));
            build.onLoad({ filter: /.*/, namespace: "artifact-source" }, () => ({
              contents: source,
              loader: "tsx",
              resolveDir: process.cwd(),
            }));
          },
        },
      ],
    });
    return {
      ok: true,
      js: result.outputFiles[0]?.text ?? "",
      warnings: result.warnings.map((warning) => warning.text),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      warnings: [],
    };
  }
}
