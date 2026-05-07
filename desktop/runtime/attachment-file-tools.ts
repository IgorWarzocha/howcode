const externalUrlPattern = /^https?:\/\//i

import { realpath, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createLsToolDefinition,
  createReadToolDefinition,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent'
import type { ComposerAttachment } from '../../shared/desktop-contracts.ts'

type AttachmentGrant = {
  files: Set<string>
  directories: Set<string>
}

const unicodeSpacesPattern = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g
const narrowNoBreakSpace = '\u202F'

export type AttachmentFileAccess = {
  grantAttachments(attachments: ComposerAttachment[]): Promise<void>
}

function isExternalReference(filePath: string) {
  return externalUrlPattern.test(filePath)
}

function isWithinDirectory(candidate: string, directory: string) {
  const relative = path.relative(directory, candidate)
  return relative.length === 0 || !(relative.startsWith('..') || path.isAbsolute(relative))
}

async function tryRealpath(filePath: string) {
  try {
    return await realpath(filePath)
  } catch {
    return path.resolve(filePath)
  }
}

async function existingPathVariant(filePath: string) {
  const candidates = [
    filePath,
    filePath.replace(/ (AM|PM)\./gi, `${narrowNoBreakSpace}$1.`),
    filePath.normalize('NFD'),
    filePath.replace(/'/g, '’'),
    filePath.normalize('NFD').replace(/'/g, '’'),
  ]
  for (const candidate of candidates) {
    try {
      await stat(candidate)
      return candidate
    } catch {
      // Try the next Pi-compatible path variant.
    }
  }
  return filePath
}

function resolveToolPath(filePath: string, cwd: string) {
  const withoutAt = filePath.startsWith('@') ? filePath.slice(1) : filePath
  const normalized = withoutAt.replace(unicodeSpacesPattern, ' ')
  const expanded =
    normalized === '~'
      ? os.homedir()
      : normalized.startsWith('~/')
        ? path.join(os.homedir(), normalized.slice(2))
        : normalized
  return path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded)
}

async function isGrantedPath(filePath: string, grants: AttachmentGrant, cwd: string) {
  const resolved = await tryRealpath(await existingPathVariant(resolveToolPath(filePath, cwd)))
  if (grants.files.has(resolved)) return true
  for (const directory of grants.directories) {
    if (isWithinDirectory(resolved, directory)) return true
  }
  return false
}

async function isGrantedDirectoryPath(filePath: string, grants: AttachmentGrant, cwd: string) {
  const resolved = await tryRealpath(await existingPathVariant(resolveToolPath(filePath, cwd)))
  return grants.directories.has(resolved)
}

async function assertGrantedPath(filePath: string, grants: AttachmentGrant, cwd: string) {
  if (await isGrantedPath(filePath, grants, cwd)) return
  throw new Error(`Path is not an attached file or inside an attached folder: ${filePath}`)
}

async function assertGrantedDirectoryPath(filePath: string, grants: AttachmentGrant, cwd: string) {
  if (await isGrantedDirectoryPath(filePath, grants, cwd)) return
  throw new Error(`Path is not an attached folder: ${filePath}`)
}

function createAttachmentFileAccess(grants: AttachmentGrant): AttachmentFileAccess {
  return {
    async grantAttachments(attachments) {
      for (const attachment of attachments) {
        const attachmentPath = attachment.path.trim()
        if (!attachmentPath || isExternalReference(attachmentPath)) continue
        try {
          const resolved = await realpath(attachmentPath)
          const metadata = await stat(resolved)
          if (metadata.isDirectory()) {
            grants.directories.add(resolved)
          } else if (metadata.isFile()) {
            grants.files.add(resolved)
          }
        } catch {
          // Invalid attachments are already rejected in the composer path; ignore stale paths here.
        }
      }
    },
  }
}

export function createAttachmentFileTools(options: { cwd: string; autoResizeImages: boolean }): {
  tools: ToolDefinition[]
  access: AttachmentFileAccess
} {
  const grants: AttachmentGrant = { files: new Set(), directories: new Set() }
  const attachmentAccess = createAttachmentFileAccess(grants)

  const readTool = createReadToolDefinition(options.cwd, {
    autoResizeImages: options.autoResizeImages,
  })
  const readExecute = readTool.execute.bind(readTool)
  readTool.execute = async (toolCallId, params, signal, onUpdate, ctx) => {
    await assertGrantedPath(params.path, grants, options.cwd)
    return await readExecute(toolCallId, params, signal, onUpdate, ctx)
  }

  const lsTool = createLsToolDefinition(options.cwd)
  const lsExecute = lsTool.execute.bind(lsTool)
  lsTool.execute = async (toolCallId, params, signal, onUpdate, ctx) => {
    await assertGrantedDirectoryPath(params.path ?? '.', grants, options.cwd)
    return await lsExecute(toolCallId, params, signal, onUpdate, ctx)
  }

  return { tools: [readTool, lsTool] as unknown as ToolDefinition[], access: attachmentAccess }
}
