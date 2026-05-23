import { processFile } from '@pierre/diffs'
import { getRenderablePatch } from './diff-panel-content.rendering'
import type { RenderablePatch } from './diff-panel-content.types'

type FileRenderablePatch = Extract<RenderablePatch, { kind: 'files' }>

type DiffParseRequest = {
  id: number
  kind?: 'reset' | 'append'
  chunk?: string
  done?: boolean
  cacheScope: string
  patch: string
}

type DiffParseResponse = {
  id: number
} & (
  | { kind: 'patch'; patch: Extract<RenderablePatch, { kind: 'raw' }> | null }
  | { kind: 'files'; files: FileRenderablePatch['files']; done: boolean }
)

const streamedFileChunkSize = 8
const gitFileBoundaryPattern = /(^|\n)(?=diff --git )/g

let activeRequestId = 0
let fileBuffer = ''
let parsedFileCount = 0
let emittedFiles = false

function findGitFileBoundaryIndexes() {
  const boundaryIndexes: number[] = []
  gitFileBoundaryPattern.lastIndex = 0
  for (;;) {
    const match = gitFileBoundaryPattern.exec(fileBuffer)
    if (!match) break
    boundaryIndexes.push(match.index + (match[1] ? 1 : 0))
  }
  return boundaryIndexes
}

function consumeFinalBufferIfDone(done: boolean) {
  if (!done) return []
  const finalBuffer = fileBuffer
  fileBuffer = ''
  return finalBuffer.trim().length > 0 ? [finalBuffer] : []
}

function discardLeadingMetadata(firstBoundary: number) {
  if (firstBoundary <= 0) return false
  fileBuffer = fileBuffer.slice(firstBoundary)
  return true
}

function takeCompleteBlocks(boundaryIndexes: number[], done: boolean) {
  const completedBoundaryCount = done ? boundaryIndexes.length : boundaryIndexes.length - 1
  if (completedBoundaryCount <= 0) return []

  const blocks = boundaryIndexes.slice(0, completedBoundaryCount).map((start, index) => {
    const end = boundaryIndexes[index + 1] ?? fileBuffer.length
    return fileBuffer.slice(start, end)
  })
  const nextBufferStart = boundaryIndexes[completedBoundaryCount] ?? fileBuffer.length
  fileBuffer = fileBuffer.slice(nextBufferStart)
  return blocks
}

function getCompleteGitFileBlocks(done: boolean): string[] {
  const boundaryIndexes = findGitFileBoundaryIndexes()
  if (boundaryIndexes.length === 0) return consumeFinalBufferIfDone(done)
  if (discardLeadingMetadata(boundaryIndexes[0] ?? 0)) return getCompleteGitFileBlocks(done)
  return takeCompleteBlocks(boundaryIndexes, done)
}

function postFileChunks(id: number, files: FileRenderablePatch['files'], done: boolean) {
  for (let index = 0; index < files.length; index += streamedFileChunkSize) {
    self.postMessage({
      id,
      kind: 'files',
      files: files.slice(index, index + streamedFileChunkSize),
      done: done && index + streamedFileChunkSize >= files.length,
    } satisfies DiffParseResponse)
  }
}

function parseCompleteFileBlocks(id: number, done: boolean) {
  const blocks = getCompleteGitFileBlocks(done)
  const files = blocks.flatMap((block) => {
    const file = processFile(block, {
      cacheKey: `${activeRequestId}:${parsedFileCount}`,
      isGitDiff: true,
    })
    parsedFileCount += 1
    return file ? [file] : []
  })

  if (files.length === 0) return
  emittedFiles = true
  postFileChunks(id, files, done)
}

function parseBufferedPartialFile(id: number, done: boolean) {
  if (done || fileBuffer.trim().length === 0 || !fileBuffer.includes('diff --git ')) return
  const file = processFile(fileBuffer, {
    cacheKey: `${activeRequestId}:${parsedFileCount}`,
    isGitDiff: true,
  })
  if (!file) return
  emittedFiles = true
  postFileChunks(id, [file], false)
}

function resetStream(id: number) {
  activeRequestId = id
  fileBuffer = ''
  parsedFileCount = 0
  emittedFiles = false
}

function postFallbackPatch(id: number, patch: string, cacheScope: string) {
  const renderablePatch = getRenderablePatch(patch, cacheScope)
  if (!renderablePatch || renderablePatch.kind === 'raw') {
    self.postMessage({ id, kind: 'patch', patch: renderablePatch } satisfies DiffParseResponse)
    return
  }

  emittedFiles = true
  postFileChunks(id, renderablePatch.files, true)
}

self.addEventListener('message', (event: MessageEvent<DiffParseRequest>) => {
  const { id, kind = 'reset', chunk = '', done = true, cacheScope, patch } = event.data
  if (kind === 'reset' || id !== activeRequestId) resetStream(id)

  fileBuffer += chunk
  parseCompleteFileBlocks(id, done)
  parseBufferedPartialFile(id, done)
  if (done && !emittedFiles) postFallbackPatch(id, patch, cacheScope)
})
