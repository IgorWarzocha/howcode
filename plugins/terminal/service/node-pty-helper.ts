import { chmodSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

// node-pty's macOS prebuilds can arrive without executable mode bits.
// Keep installed helpers executable without rewriting dependency source or paths.
export function ensureNodePtyHelpersExecutable(nodePtyRoot: string, architecture: string) {
  for (const directory of ['build/Release', 'build/Debug', `prebuilds/darwin-${architecture}`]) {
    const helper = path.join(nodePtyRoot, directory, 'spawn-helper')
    if (!existsSync(helper)) continue
    const mode = statSync(helper).mode
    if ((mode & 0o111) !== 0o111) chmodSync(helper, mode | 0o111)
  }
}
