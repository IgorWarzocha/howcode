import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

const requireFromHost = createRequire(import.meta.url)

/** Utility CSS belongs to the admitted renderer generation, not shell source scanning. */
export async function compileComponentUtilities(js: string, name: string): Promise<string> {
  const candidates = new Scanner({}).scanFiles([{ content: js, extension: 'js' }])
  const compiler = await compile(
    `@import "tailwindcss/theme.css" theme(reference);
@scope ([data-howcode-component=${JSON.stringify(name)}]) to ([data-howcode-component]) {
  @tailwind utilities;
}`,
    {
      base: dirname(requireFromHost.resolve('tailwindcss/package.json')),
      onDependency() {
        // The immutable host compiler theme does not require a generation watcher.
      },
    },
  )
  return compiler.build(candidates)
}
