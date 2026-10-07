import { createRequire } from 'node:module'

const requireFromHere = createRequire(import.meta.url)
const reactImportPattern = /^(react|react-dom)(\/.*)?$/
const reactImports = new Set([
  'react',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
])

export async function compilePackageUi(entry: string): Promise<string> {
  const { build } = await import('esbuild')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    logLevel: 'silent',
    plugins: [
      {
        name: 'package-ui-react',
        setup(builder) {
          builder.onResolve({ filter: reactImportPattern }, (args) =>
            reactImports.has(args.path) ? { path: requireFromHere.resolve(args.path) } : undefined,
          )
        },
      },
    ],
  })
  if (result.outputFiles.length !== 1 || !result.outputFiles[0])
    throw new Error(
      'Package UI must bundle into one JavaScript module. Import CSS as text and own its lifecycle.',
    )
  return result.outputFiles[0].text
}
