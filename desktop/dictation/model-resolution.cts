import { existsSync, readdirSync, type Dirent } from "node:fs";
import path from "node:path";
import type { DictationModelId } from "../../shared/desktop-contracts.ts";
import {
  normalizeWhisperLanguage,
  resolveWhisperModelFilesFromFilePaths,
  type ResolvedWhisperModelFiles,
} from "../../shared/dictation-helpers.ts";
import {
  dictationModelDefinitions,
  getDictationModelDefinition,
} from "../../shared/dictation-models.ts";
import { loadAppSettings } from "../app-settings.cts";
import { getDesktopUserDataPath } from "../user-data-path.cts";

export type DictationModelFiles = ResolvedWhisperModelFiles;

export const DEFAULT_DICTATION_MODEL_DIRECTORY = path.join(
  getDesktopUserDataPath(),
  "models",
  "whisper",
);

const DICTATION_MODEL_DIR_ENV_KEYS = [
  "HOWCODE_SHERPA_ONNX_MODEL_DIR",
  "HOWCODE_DICTATION_MODEL_DIR",
] as const;

export function getDictationModelDirectories() {
  const configuredDirectories = DICTATION_MODEL_DIR_ENV_KEYS.map((key) =>
    process.env[key]?.trim(),
  ).filter((value): value is string => Boolean(value));

  return [...new Set([...configuredDirectories, DEFAULT_DICTATION_MODEL_DIRECTORY])];
}

export function getDictationModelsRootDirectory() {
  const [modelDirectory = DEFAULT_DICTATION_MODEL_DIRECTORY] = getDictationModelDirectories();
  return modelDirectory;
}

export function getDictationModelDirectory(modelId: DictationModelId) {
  return path.join(getDictationModelsRootDirectory(), modelId);
}

export function getManagedDictationModelFiles(
  modelId: DictationModelId,
): DictationModelFiles | null {
  const definition = getDictationModelDefinition(modelId);
  if (!definition) {
    return null;
  }

  const modelDirectory = getDictationModelDirectory(modelId);
  const encoderPath = path.join(modelDirectory, definition.files.encoder);
  const decoderPath = path.join(modelDirectory, definition.files.decoder);
  const tokensPath = path.join(modelDirectory, definition.files.tokens);

  if (!existsSync(encoderPath) || !existsSync(decoderPath) || !existsSync(tokensPath)) {
    return null;
  }

  return {
    modelDirectory,
    encoderPath,
    decoderPath,
    tokensPath,
    modelId,
    language: normalizeWhisperLanguage(modelId),
  };
}

function getInstalledManagedDictationModelFiles() {
  return dictationModelDefinitions.flatMap((definition) => {
    const modelFiles = getManagedDictationModelFiles(definition.id);
    return modelFiles ? [modelFiles] : [];
  });
}

function collectCandidateFiles(rootDirectory: string, maxDepth = 3) {
  const pending = [{ directoryPath: rootDirectory, depth: 0 }];
  const filePaths: string[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = readdirSync(current.directoryPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current.directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (current.depth < maxDepth) {
          pending.push({ directoryPath: entryPath, depth: current.depth + 1 });
        }

        continue;
      }

      if (entry.isFile()) {
        filePaths.push(entryPath);
      }
    }
  }

  return filePaths;
}

function resolveConfiguredDictationModelFilesFromDirectory(
  directoryPath: string,
  modelId?: DictationModelId,
) {
  const candidateFiles = collectCandidateFiles(directoryPath);

  if (!modelId) {
    return resolveWhisperModelFilesFromFilePaths(candidateFiles);
  }

  return resolveWhisperModelFilesFromFilePaths(
    candidateFiles.filter((filePath) => path.basename(filePath).startsWith(`${modelId}-`)),
  );
}

export function findConfiguredDictationModelFiles(modelId?: DictationModelId) {
  for (const directoryPath of getDictationModelDirectories()) {
    const modelFiles = resolveConfiguredDictationModelFilesFromDirectory(directoryPath, modelId);
    if (!modelFiles) {
      continue;
    }

    return modelFiles;
  }

  return null;
}

export function getSelectedDictationModelFiles() {
  const appSettings = loadAppSettings();
  const selectedModelId = appSettings.dictationModelId;
  const selectedModelFiles = selectedModelId
    ? (getManagedDictationModelFiles(selectedModelId) ??
      findConfiguredDictationModelFiles(selectedModelId))
    : null;

  if (selectedModelFiles) {
    return selectedModelFiles;
  }

  return getInstalledManagedDictationModelFiles()[0] ?? null;
}

export function getResolvedDictationModelFiles() {
  return getSelectedDictationModelFiles() ?? findConfiguredDictationModelFiles();
}

export function getInstalledManagedDictationModelDirectory(modelId: DictationModelId) {
  return getManagedDictationModelFiles(modelId)?.modelDirectory ?? null;
}
