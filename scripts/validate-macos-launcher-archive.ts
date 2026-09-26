import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readdir, readlink, realpath, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const frameworkRelativePath = path.join(
  'howcode.app',
  'Contents',
  'Frameworks',
  'Electron Framework.framework',
)

async function checkFrameworkLink(entryPath: string, resolvedFrameworkPath: string) {
  const link = await readlink(entryPath)
  if (path.isAbsolute(link)) {
    throw new Error(`Non-portable Electron framework link: ${entryPath} -> ${link}`)
  }
  const destination = await realpath(entryPath).catch(() => {
    throw new Error(`Broken Electron framework link: ${entryPath} -> ${link}`)
  })
  if (!destination.startsWith(`${resolvedFrameworkPath}${path.sep}`)) {
    throw new Error(`Escaping Electron framework link: ${entryPath} -> ${link}`)
  }
}

async function checkFrameworkLinks(frameworkPath: string) {
  const resolvedFrameworkPath = await realpath(frameworkPath)
  const stack = [frameworkPath]
  while (stack.length > 0) {
    const directory = stack.pop()
    if (!directory) continue
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.isSymbolicLink()) {
        await checkFrameworkLink(entryPath, resolvedFrameworkPath)
      }
    }
  }
}

/** Check the archive that will be published, not the electron-builder input. */
export async function validateMacosLauncherArchive(archivePath: string) {
  const extractionRoot = await mkdtemp(path.join(os.tmpdir(), 'howcode-macos-archive-check-'))
  try {
    const result = spawnSync(
      'tar',
      ['-xzf', archivePath, '-C', extractionRoot, frameworkRelativePath],
      { encoding: 'utf8' },
    )
    if (result.status !== 0) {
      throw new Error(`Cannot extract Electron framework from ${archivePath}: ${result.stderr}`)
    }
    const frameworkPath = path.join(extractionRoot, frameworkRelativePath)
    const currentPath = path.join(frameworkPath, 'Versions', 'Current')
    const binaryPath = path.join(frameworkPath, 'Electron Framework')
    if (!(await lstat(currentPath)).isSymbolicLink()) {
      throw new Error('Electron framework Versions/Current must be a symlink')
    }
    if (!(await lstat(binaryPath)).isSymbolicLink()) {
      throw new Error('Electron framework executable must be a symlink')
    }
    await checkFrameworkLinks(frameworkPath)
    const binary = await stat(binaryPath)
    if (!binary.isFile() || binary.size === 0) {
      throw new Error('Electron framework executable is missing or empty')
    }
  } finally {
    await rm(extractionRoot, { recursive: true, force: true })
  }
}
