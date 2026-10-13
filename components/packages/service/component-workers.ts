import type { Plugin } from 'esbuild'

const workerImport = /\?worker(?:&inline)?$/
const anyModule = /.*/

/** Package workers remain part of the immutable renderer source, not host assets. */
export function componentWorkers(): Plugin {
  return {
    name: 'howcode-component-workers',
    setup(builder) {
      builder.onResolve({ filter: workerImport }, async (args) => {
        const resolved = await builder.resolve(args.path.replace(workerImport, ''), {
          resolveDir: args.resolveDir,
          kind: 'import-statement',
        })
        return { path: resolved.path, errors: resolved.errors, namespace: 'howcode-worker' }
      })
      builder.onLoad({ filter: anyModule, namespace: 'howcode-worker' }, async (args) => {
        const { build } = await import('esbuild')
        const result = await build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          format: 'iife',
          platform: 'browser',
          target: 'es2022',
          logLevel: 'silent',
        })
        const source = result.outputFiles[0]?.text
        if (!source || result.outputFiles.length !== 1)
          throw new Error('Component worker must compile to one self-contained script.')
        return {
          loader: 'js',
          contents: `export default function ComponentWorker(options) {
            const url = URL.createObjectURL(new Blob([${JSON.stringify(source)}], {type:'text/javascript'}));
            try { return new Worker(url, {...options, type:'classic'}); }
            finally { URL.revokeObjectURL(url); }
          }`,
        }
      })
    },
  }
}
