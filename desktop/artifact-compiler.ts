import { createRequire } from 'node:module'
import type { ReactArtifactCompileResult } from '../shared/desktop-contracts.ts'

const previewRuntimeImports = new Set([
  'react',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
])
const artifactSourcePathPattern = /^artifact:source$/
const anyImportPathPattern = /.*/
const requireFromHere = createRequire(import.meta.url)
const reactImportPattern = /(?:^|\n)\s*import\s+(?:[^'"]+?\s+from\s+)?['"]react['"]/m
const reactNamespacePattern = /\bReact\s*\./
const bareHookPattern = /\b(?:useState|useEffect|useMemo|useCallback|useRef|useReducer)\s*\(/

function normalizeReactArtifactSource(source: string) {
  if (reactImportPattern.test(source)) return source

  const needsReactNamespace = reactNamespacePattern.test(source)
  const needsBareHooks = bareHookPattern.test(source)
  if (!(needsReactNamespace || needsBareHooks)) return source

  const imports = [
    needsReactNamespace ? 'React' : null,
    needsBareHooks ? '{ useCallback, useEffect, useMemo, useReducer, useRef, useState }' : null,
  ].filter(Boolean)

  return `import ${imports.join(', ')} from 'react';\n${source}`
}

export async function compileReactArtifact(source: string): Promise<ReactArtifactCompileResult> {
  try {
    const esbuild = await import('esbuild')
    const normalizedSource = normalizeReactArtifactSource(source)
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
        loader: 'tsx',
        resolveDir: process.cwd(),
        sourcefile: 'artifact-preview-entry.tsx',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      logLevel: 'silent',
      treeShaking: true,
      plugins: [
        {
          name: 'artifact-source',
          setup(build) {
            build.onResolve({ filter: anyImportPathPattern }, (args) => {
              if (previewRuntimeImports.has(args.path)) {
                return { path: requireFromHere.resolve(args.path) }
              }
            })
            build.onResolve({ filter: artifactSourcePathPattern }, (args) => ({
              path: args.path,
              namespace: 'artifact-source',
            }))
            build.onResolve(
              { filter: anyImportPathPattern, namespace: 'artifact-source' },
              (args) => {
                if (previewRuntimeImports.has(args.path)) {
                  return { path: requireFromHere.resolve(args.path) }
                }

                return {
                  errors: [
                    {
                      text: `React artifacts cannot import ${JSON.stringify(args.path)}. Keep artifacts self-contained; React is provided by the preview runtime.`,
                    },
                  ],
                }
              },
            )
            build.onLoad({ filter: anyImportPathPattern, namespace: 'artifact-source' }, () => ({
              contents: normalizedSource,
              loader: 'tsx',
            }))
          },
        },
      ],
    })
    return {
      ok: true,
      js: result.outputFiles[0]?.text ?? '',
      warnings: result.warnings.map((warning) => warning.text),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      warnings: [],
    }
  }
}
