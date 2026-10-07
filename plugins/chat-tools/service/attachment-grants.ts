import { realpath, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { defineDoc } from '@earendil-works/pi-durable'
import { mapWithConcurrency } from '../../../desktop/pi-threads/map-with-concurrency.ts'
import type { ComposerAttachment } from '../../../shared/desktop-contracts.ts'

const externalUrlPattern = /^https?:\/\//i
const unicodeSpacesPattern = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g
const timeSpacePattern = / (AM|PM)\./gi
const apostrophePattern = /'/g

export const AttachmentGrantsDoc = defineDoc<{ files: string[]; directories: string[] }>({
  kind: 'howcode.attachments',
  version: 1,
  scope: 'conversation',
  history: 'rewindable',
  fork: 'asOf',
  initial: () => ({ files: [], directories: [] }),
})

export async function resolveAttachmentGrants(attachments: ComposerAttachment[]) {
  const files: string[] = []
  const directories: string[] = []
  await mapWithConcurrency(attachments, 8, async (attachment) => {
    if (externalUrlPattern.test(attachment.path)) return
    const resolved = await realpath(attachment.path)
    const metadata = await stat(resolved)
    if (metadata.isDirectory()) directories.push(resolved)
    else if (metadata.isFile()) files.push(resolved)
    else throw new Error(`Unsupported attachment: ${attachment.path}`)
  })
  return { files, directories }
}

async function existingVariant(absolute: string) {
  const candidates = [
    absolute,
    absolute.replace(timeSpacePattern, '\u202F$1.'),
    absolute.normalize('NFD'),
    absolute.replace(apostrophePattern, '’'),
    absolute.normalize('NFD').replace(apostrophePattern, '’'),
  ]
  for (const candidate of candidates) {
    try {
      return await realpath(candidate)
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
  }
  return undefined
}

export async function authorizeAttachmentPath(
  filePath: string,
  cwd: string,
  grants: { readonly files: readonly string[]; readonly directories: readonly string[] },
  directoryOnly = false,
) {
  const withoutAt = filePath.startsWith('@') ? filePath.slice(1) : filePath
  const normalized = withoutAt.replace(unicodeSpacesPattern, ' ')
  const expanded =
    normalized === '~'
      ? os.homedir()
      : normalized.startsWith('~/')
        ? path.join(os.homedir(), normalized.slice(2))
        : normalized
  const absolute = path.resolve(cwd, expanded)
  const resolved = await existingVariant(absolute)
  if (
    resolved &&
    (directoryOnly
      ? grants.directories.includes(resolved)
      : grants.files.includes(resolved) ||
        grants.directories.some((directory) => {
          const relative = path.relative(directory, resolved)
          return relative === '' || !(relative.startsWith('..') || path.isAbsolute(relative))
        }))
  )
    return resolved
  throw new Error(
    directoryOnly
      ? `Path is not an attached folder: ${filePath}`
      : `Path is not an attached file or inside an attached folder: ${filePath}`,
  )
}
