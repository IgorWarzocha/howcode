import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  DictationModelId,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
} from "../../shared/desktop-contracts.ts";
import {
  dictationModelDefinitions,
  getDictationModelDefinition,
  getDictationModelDownloadSizeLabel,
} from "../../shared/dictation-models.ts";
import { emitDesktopEvent } from "../runtime/desktop-events.cts";
import {
  findConfiguredDictationModelFiles,
  getDictationModelDirectory,
  getDictationModelsRootDirectory,
  getInstalledManagedDictationModelDirectory,
  getManagedDictationModelFiles,
  getResolvedDictationModelFiles,
} from "./model-resolution.cts";
import { resetRecognizerCache } from "./sherpa-runtime.cts";

function emitDictationDownloadLog(
  modelId: DictationModelId,
  message: string,
  options: { done?: boolean; isError?: boolean } = {},
) {
  emitDesktopEvent({
    type: "dictation-download-log",
    modelId,
    message,
    at: new Date().toISOString(),
    done: options.done ?? false,
    isError: options.isError ?? false,
  });
}

function buildHuggingFaceResolveUrl(repo: string, fileName: string) {
  return `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(fileName)}?download=true`;
}

type DownloadMetadata = {
  contentLength: number | null;
  etag: string | null;
};

function normalizeEtag(etag: string | null) {
  if (!etag) {
    return null;
  }

  return etag.replace(/^W\//, "").replace(/^"|"$/g, "").trim().toLowerCase() || null;
}

function getEtagHashAlgorithm(etag: string | null) {
  if (!etag) {
    return null;
  }

  if (/^[a-f0-9]{64}$/i.test(etag)) {
    return "sha256" as const;
  }

  if (/^[a-f0-9]{40}$/i.test(etag)) {
    return "sha1" as const;
  }

  return null;
}

async function validateDownloadedFile(targetPath: string, metadata: DownloadMetadata) {
  const fileStats = await stat(targetPath);
  if (!fileStats.isFile() || fileStats.size <= 0) {
    throw new Error(`Download failed: ${path.basename(targetPath)} is empty.`);
  }

  if (metadata.contentLength !== null && fileStats.size !== metadata.contentLength) {
    throw new Error(
      `Download failed: ${path.basename(targetPath)} size mismatch (${fileStats.size} != ${metadata.contentLength}).`,
    );
  }

  const normalizedEtag = normalizeEtag(metadata.etag);
  const hashAlgorithm = getEtagHashAlgorithm(normalizedEtag);
  if (!normalizedEtag || !hashAlgorithm) {
    return;
  }

  const fileHash = createHash(hashAlgorithm)
    .update(await readFile(targetPath))
    .digest("hex");

  if (fileHash !== normalizedEtag) {
    throw new Error(`Download failed: ${path.basename(targetPath)} checksum mismatch.`);
  }
}

async function downloadToFile(url: string, targetPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText}) for ${url}`);
  }

  if (!response.body) {
    throw new Error(`Download failed: missing response body for ${url}`);
  }

  const temporaryPath = `${targetPath}.partial`;
  const metadata: DownloadMetadata = {
    contentLength: Number.parseInt(response.headers.get("content-length") ?? "", 10) || null,
    etag: response.headers.get("etag"),
  };

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(temporaryPath),
    );
    await validateDownloadedFile(temporaryPath, metadata);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function createDictationDownloadStagePath(modelId: DictationModelId) {
  return path.join(
    getDictationModelsRootDirectory(),
    `.${modelId}.download-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
}

function createDictationBackupPath(modelId: DictationModelId) {
  return path.join(
    getDictationModelsRootDirectory(),
    `.${modelId}.backup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
}

export async function listManagedAndConfiguredDictationModels(): Promise<DictationModelSummary[]> {
  const resolvedModelId = getResolvedDictationModelFiles()?.modelId ?? null;

  return dictationModelDefinitions.map((definition) => {
    const managed = getManagedDictationModelFiles(definition.id) !== null;
    const installed = managed || findConfiguredDictationModelFiles(definition.id) !== null;

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      downloadSizeBytes: definition.downloadSizeBytes,
      downloadSizeLabel: getDictationModelDownloadSizeLabel(definition.downloadSizeBytes),
      installed,
      managed,
      selected: installed && resolvedModelId === definition.id,
    };
  });
}

export async function installManagedDictationModel(
  modelId: DictationModelId,
): Promise<DictationModelInstallResult> {
  const definition = getDictationModelDefinition(modelId);
  if (!definition) {
    return {
      ok: false,
      modelId,
      error: "Unknown dictation model.",
    };
  }

  const modelDirectory = getDictationModelDirectory(modelId);
  const stagingDirectory = createDictationDownloadStagePath(modelId);
  const downloadedFiles = [
    definition.files.encoder,
    definition.files.decoder,
    definition.files.tokens,
  ];

  try {
    emitDictationDownloadLog(modelId, `Preparing ${definition.name} download…`);
    await mkdir(stagingDirectory, { recursive: true });

    for (const fileName of downloadedFiles) {
      emitDictationDownloadLog(modelId, `Downloading ${fileName}…`);
      await downloadToFile(
        buildHuggingFaceResolveUrl(definition.huggingFaceRepo, fileName),
        path.join(stagingDirectory, fileName),
      );
      emitDictationDownloadLog(modelId, `Validated ${fileName}.`);
    }

    emitDictationDownloadLog(modelId, "Finalizing model install…");
    const existingManagedDirectory = existsSync(modelDirectory) ? modelDirectory : null;
    const backupDirectory = existingManagedDirectory ? createDictationBackupPath(modelId) : null;

    if (existingManagedDirectory && backupDirectory) {
      await rename(existingManagedDirectory, backupDirectory);
    }

    try {
      await rename(stagingDirectory, modelDirectory);

      if (backupDirectory) {
        await rm(backupDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      if (backupDirectory) {
        await rename(backupDirectory, modelDirectory).catch(() => undefined);
      }

      throw error;
    }

    resetRecognizerCache();
    emitDictationDownloadLog(modelId, `${definition.name} is ready.`, { done: true });

    return {
      ok: true,
      modelId,
      error: null,
    };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);

    emitDictationDownloadLog(
      modelId,
      error instanceof Error ? error.message : "Could not download dictation model.",
      { done: true, isError: true },
    );

    return {
      ok: false,
      modelId,
      error: error instanceof Error ? error.message : "Could not download dictation model.",
    };
  }
}

export async function removeManagedDictationModel(
  modelId: DictationModelId,
): Promise<DictationModelRemoveResult> {
  const definition = getDictationModelDefinition(modelId);
  if (!definition) {
    return {
      ok: false,
      modelId,
      error: "Unknown dictation model.",
    };
  }

  const modelDirectory = getInstalledManagedDictationModelDirectory(modelId);
  if (!modelDirectory) {
    return {
      ok: true,
      modelId,
      error: null,
    };
  }

  try {
    emitDictationDownloadLog(modelId, `Removing ${definition.name}…`);
    await rm(modelDirectory, { recursive: true, force: true });
    resetRecognizerCache();
    emitDictationDownloadLog(modelId, `${definition.name} was removed.`, { done: true });

    return {
      ok: true,
      modelId,
      error: null,
    };
  } catch (error) {
    emitDictationDownloadLog(
      modelId,
      error instanceof Error ? error.message : "Could not remove dictation model.",
      { done: true, isError: true },
    );

    return {
      ok: false,
      modelId,
      error: error instanceof Error ? error.message : "Could not remove dictation model.",
    };
  }
}
