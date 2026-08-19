import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  DictationModelId,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
} from '../../shared/desktop-contracts.ts'
import {
  dictationModelDefinitions,
  getDictationModelDefinition,
  getDictationModelDownloadSizeLabel,
} from '../../shared/dictation-models.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import {
  type DownloadMetadata,
  fetchDownloadResponse,
  getDownloadChecksumExpectations,
} from './model-download.ts'
import {
  findConfiguredDictationModelFiles,
  getDictationModelDirectory,
  getDictationModelsRootDirectory,
  getInstalledManagedDictationModelDirectory,
  getManagedDictationModelFiles,
  getResolvedDictationModelFiles,
} from './model-resolution.ts'
import { resetRecognizerCache } from './sherpa-runtime.ts'

function emitDictationDownloadLog(
  modelId: DictationModelId,
  message: string,
  options: { done?: boolean | undefined; isError?: boolean | undefined } = {},
) {
  emitDesktopEvent({
    type: 'dictation-download-log',
    modelId,
    message,
    at: new Date().toISOString(),
    done: options.done ?? false,
    isError: options.isError ?? false,
  })
}

function buildHuggingFaceResolveUrl(repo: string, fileName: string) {
  return `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(fileName)}?download=true`
}

async function validateDownloadedFile(targetPath: string, metadata: DownloadMetadata) {
  const fileStats = await stat(targetPath)
  if (!fileStats.isFile() || fileStats.size <= 0) {
    throw new Error(`Download failed: ${path.basename(targetPath)} is empty.`)
  }

  if (metadata.contentLength !== null && fileStats.size !== metadata.contentLength) {
    throw new Error(
      `Download failed: ${path.basename(targetPath)} size mismatch (${fileStats.size} != ${metadata.contentLength}).`,
    )
  }

  const checksumExpectations = getDownloadChecksumExpectations(metadata.etag, fileStats.size)
  if (checksumExpectations.length === 0) {
    return
  }

  const hashes = checksumExpectations.map((expectation) => {
    const hash = createHash(expectation.algorithm)
    if (expectation.prefix) {
      hash.update(expectation.prefix)
    }

    return {
      expected: expectation.expected,
      hash,
    }
  })

  for await (const chunk of createReadStream(targetPath)) {
    for (const candidate of hashes) {
      candidate.hash.update(chunk)
    }
  }

  const matchesChecksum = hashes.some(
    (candidate) => candidate.hash.digest('hex') === candidate.expected,
  )
  if (!matchesChecksum) {
    throw new Error(`Download failed: ${path.basename(targetPath)} checksum mismatch.`)
  }
}

async function downloadToFile(url: string, targetPath: string) {
  const { response, metadata } = await fetchDownloadResponse(url)
  if (!response.body) {
    throw new Error(`Download failed: missing response body for ${url}`)
  }

  const temporaryPath = `${targetPath}.partial`

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(temporaryPath),
    )
    await validateDownloadedFile(temporaryPath, metadata)
    await rename(temporaryPath, targetPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function createDictationDownloadStagePath(modelId: DictationModelId) {
  return path.join(
    getDictationModelsRootDirectory(),
    `.${modelId}.download-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  )
}

function createDictationBackupPath(modelId: DictationModelId) {
  return path.join(
    getDictationModelsRootDirectory(),
    `.${modelId}.backup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  )
}

export async function listManagedAndConfiguredDictationModels(): Promise<DictationModelSummary[]> {
  const resolvedModelId = getResolvedDictationModelFiles()?.modelId ?? null

  return dictationModelDefinitions.map((definition) => {
    const managed = getManagedDictationModelFiles(definition.id) !== null
    const installed = managed || findConfiguredDictationModelFiles(definition.id) !== null

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      downloadSizeBytes: definition.downloadSizeBytes,
      downloadSizeLabel: getDictationModelDownloadSizeLabel(definition.downloadSizeBytes),
      installed,
      managed,
      selected: installed && resolvedModelId === definition.id,
    }
  })
}

type DictationModelDefinition = NonNullable<ReturnType<typeof getDictationModelDefinition>>

function getDictationInstallFiles(definition: DictationModelDefinition) {
  return [definition.files.encoder, definition.files.decoder, definition.files.tokens]
}

async function downloadDictationModelFiles(input: {
  definition: DictationModelDefinition
  modelId: DictationModelId
  stagingDirectory: string
}) {
  emitDictationDownloadLog(input.modelId, `Preparing ${input.definition.name} download…`)
  await mkdir(input.stagingDirectory, { recursive: true })
  await getDictationInstallFiles(input.definition).reduce<Promise<void>>(
    (pending, fileName) =>
      pending.then(async () => {
        emitDictationDownloadLog(input.modelId, `Downloading ${fileName}…`)
        await downloadToFile(
          buildHuggingFaceResolveUrl(input.definition.huggingFaceRepo, fileName),
          path.join(input.stagingDirectory, fileName),
        )
        emitDictationDownloadLog(input.modelId, `Validated ${fileName}.`)
      }),
    Promise.resolve(),
  )
}

async function restoreDictationInstallBackup(input: {
  backupDirectory: string
  error: unknown
  modelDirectory: string
}) {
  try {
    await rename(input.backupDirectory, input.modelDirectory)
  } catch (restoreError) {
    const installErrorMessage =
      input.error instanceof Error ? input.error.message : String(input.error)
    const restoreErrorMessage =
      restoreError instanceof Error ? restoreError.message : String(restoreError)
    throw new Error(
      `Could not finalize dictation model install (${installErrorMessage}) and failed to restore the previous model (${restoreErrorMessage}).`,
    )
  }
}

async function finalizeDictationModelInstall(input: {
  modelDirectory: string
  modelId: DictationModelId
  stagingDirectory: string
}) {
  emitDictationDownloadLog(input.modelId, 'Finalizing model install…')
  const backupDirectory = existsSync(input.modelDirectory)
    ? createDictationBackupPath(input.modelId)
    : null
  if (backupDirectory) await rename(input.modelDirectory, backupDirectory)
  try {
    await rename(input.stagingDirectory, input.modelDirectory)
  } catch (error) {
    if (backupDirectory) {
      await restoreDictationInstallBackup({
        backupDirectory,
        error,
        modelDirectory: input.modelDirectory,
      })
    }
    throw error
  }
  return backupDirectory
}

async function removeDictationInstallBackup(input: {
  backupDirectory: string | null
  definition: DictationModelDefinition
  modelId: DictationModelId
}) {
  if (!input.backupDirectory) return
  try {
    await rm(input.backupDirectory, { recursive: true, force: true })
  } catch (error) {
    emitDictationDownloadLog(
      input.modelId,
      error instanceof Error
        ? `Installed ${input.definition.name}, but could not remove the previous backup: ${error.message}`
        : `Installed ${input.definition.name}, but could not remove the previous backup.`,
    )
  }
}

function getDictationInstallErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not download dictation model.'
}

export async function installManagedDictationModel(
  modelId: DictationModelId,
): Promise<DictationModelInstallResult> {
  const definition = getDictationModelDefinition(modelId)
  if (!definition) {
    return { ok: false, modelId, error: 'Unknown dictation model.' }
  }

  const modelDirectory = getDictationModelDirectory(modelId)
  const stagingDirectory = createDictationDownloadStagePath(modelId)
  try {
    await downloadDictationModelFiles({ definition, modelId, stagingDirectory })
    const backupDirectory = await finalizeDictationModelInstall({
      modelDirectory,
      modelId,
      stagingDirectory,
    })
    await removeDictationInstallBackup({ backupDirectory, definition, modelId })
    resetRecognizerCache()
    emitDictationDownloadLog(modelId, `${definition.name} is ready.`, { done: true })
    return { ok: true, modelId, error: null }
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined)
    emitDictationDownloadLog(modelId, getDictationInstallErrorMessage(error), {
      done: true,
      isError: true,
    })
    return { ok: false, modelId, error: getDictationInstallErrorMessage(error) }
  }
}

export async function removeManagedDictationModel(
  modelId: DictationModelId,
): Promise<DictationModelRemoveResult> {
  const definition = getDictationModelDefinition(modelId)
  if (!definition) {
    return {
      ok: false,
      modelId,
      error: 'Unknown dictation model.',
    }
  }

  const modelDirectory = getInstalledManagedDictationModelDirectory(modelId)
  if (!modelDirectory) {
    return {
      ok: true,
      modelId,
      error: null,
    }
  }

  try {
    emitDictationDownloadLog(modelId, `Removing ${definition.name}…`)
    await rm(modelDirectory, { recursive: true, force: true })
    resetRecognizerCache()
    emitDictationDownloadLog(modelId, `${definition.name} was removed.`, { done: true })

    return {
      ok: true,
      modelId,
      error: null,
    }
  } catch (error) {
    emitDictationDownloadLog(
      modelId,
      error instanceof Error ? error.message : 'Could not remove dictation model.',
      { done: true, isError: true },
    )

    return {
      ok: false,
      modelId,
      error: error instanceof Error ? error.message : 'Could not remove dictation model.',
    }
  }
}
