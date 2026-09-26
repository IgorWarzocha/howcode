import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateMacosLauncherArchive } from '../../scripts/validate-macos-launcher-archive'

const temporaryDirectories: string[] = []

async function archiveFramework(
  options: {
    verbatimSymlinks?: boolean
    currentTarget?: string
    includeExecutable?: boolean
    includeFramework?: boolean
  } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'howcode-framework-fixture-'))
  temporaryDirectories.push(root)
  const sourceApp = path.join(root, 'source', 'howcode.app')
  const framework = path.join(sourceApp, 'Contents', 'Frameworks', 'Electron Framework.framework')
  if (options.includeFramework === false) {
    await mkdir(sourceApp, { recursive: true })
  } else {
    await mkdir(path.join(framework, 'Versions', 'A'), { recursive: true })
    if (options.includeExecutable !== false) {
      await writeFile(path.join(framework, 'Versions', 'A', 'Electron Framework'), 'binary')
    }
    await symlink(options.currentTarget ?? 'A', path.join(framework, 'Versions', 'Current'))
    await symlink('Versions/Current/Electron Framework', path.join(framework, 'Electron Framework'))
  }
  const archiveRoot = path.join(root, 'archive')
  await mkdir(archiveRoot)
  await cp(sourceApp, path.join(archiveRoot, 'howcode.app'), {
    recursive: true,
    verbatimSymlinks: options.verbatimSymlinks ?? false,
  })
  const archivePath = path.join(root, 'howcode-macos-arm64.tar.gz')
  const result = spawnSync('tar', ['-czf', archivePath, '-C', archiveRoot, 'howcode.app'])
  if (result.status !== 0) throw new Error('Failed to create framework test archive')
  return archivePath
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('portable macOS launcher archive', () => {
  it('rejects the absolute build-runner symlinks introduced by default cp', async () => {
    const archive = await archiveFramework()
    await expect(validateMacosLauncherArchive(archive)).rejects.toThrow(
      'Non-portable Electron framework link',
    )
  })

  it('accepts intact relative framework links after copying verbatim', async () => {
    const archive = await archiveFramework({ verbatimSymlinks: true })
    await expect(validateMacosLauncherArchive(archive)).resolves.toBeUndefined()
  })

  it('rejects a missing framework or a broken Current link', async () => {
    const missing = await archiveFramework({ includeFramework: false })
    await expect(validateMacosLauncherArchive(missing)).rejects.toThrow(
      'Cannot extract Electron framework',
    )
    const broken = await archiveFramework({ verbatimSymlinks: true, currentTarget: 'Missing' })
    await expect(validateMacosLauncherArchive(broken)).rejects.toThrow(
      'Broken Electron framework link',
    )
  })

  it('rejects a missing framework executable', async () => {
    const archive = await archiveFramework({ verbatimSymlinks: true, includeExecutable: false })
    await expect(validateMacosLauncherArchive(archive)).rejects.toThrow(
      'Broken Electron framework link',
    )
  })
})
