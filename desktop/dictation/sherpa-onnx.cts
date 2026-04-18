import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  DictationModelId,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
} from "../../shared/desktop-contracts.ts";
import { decodePcm16MonoBytes, normalizeWhisperLanguage } from "../../shared/dictation-helpers.ts";
import {
  dictationModelDefinitions,
  getDictationModelDefinition,
  getDictationModelDownloadSizeLabel,
} from "../../shared/dictation-models.ts";
import {
  DEFAULT_DICTATION_MODEL_DIRECTORY,
  findConfiguredDictationModelFiles,
  getDictationModelDirectories,
  getDictationModelDirectory,
  getDictationModelsRootDirectory,
  getInstalledManagedDictationModelDirectory,
  getManagedDictationModelFiles,
  getResolvedDictationModelFiles,
  type DictationModelFiles,
} from "./model-resolution.cts";
import { emitDesktopEvent } from "../runtime/desktop-events.cts";

type SherpaOfflineStream = {
  acceptWaveform: (input: { samples: Float32Array; sampleRate: number }) => void;
};

type SherpaOfflineRecognizerResult = {
  lang?: string;
  text?: string;
};

type SherpaOfflineRecognizer = {
  createStream: () => SherpaOfflineStream;
  decodeAsync: (stream: SherpaOfflineStream) => Promise<SherpaOfflineRecognizerResult>;
};

type SherpaOnnxModule = {
  OfflineRecognizer: {
    createAsync: (config: Record<string, unknown>) => Promise<SherpaOfflineRecognizer>;
  };
};

const sherpaRequire = createRequire(import.meta.url);

let sherpaOnnxModulePromise: Promise<SherpaOnnxModule> | null = null;
let recognizerCache: {
  key: string;
  promise: Promise<SherpaOfflineRecognizer>;
} | null = null;

function getSherpaPlatformPackageName() {
  switch (`${process.platform}-${process.arch}`) {
    case "darwin-arm64":
      return "sherpa-onnx-darwin-arm64";
    case "darwin-x64":
      return "sherpa-onnx-darwin-x64";
    case "linux-arm64":
      return "sherpa-onnx-linux-arm64";
    case "linux-x64":
      return "sherpa-onnx-linux-x64";
    case "win32-ia32":
      return "sherpa-onnx-win-ia32";
    case "win32-x64":
      return "sherpa-onnx-win-x64";
    default:
      return null;
  }
}

function prependLibraryPath(
  envKey: "DYLD_LIBRARY_PATH" | "LD_LIBRARY_PATH",
  directoryPath: string,
) {
  const current = process.env[envKey];
  const entries = (current ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.includes(directoryPath)) {
    return;
  }

  process.env[envKey] = [directoryPath, ...entries].join(path.delimiter);
}

function ensureSherpaLibraryPath() {
  const packageName = getSherpaPlatformPackageName();
  if (!packageName) {
    return;
  }

  try {
    const packageJsonPath = sherpaRequire.resolve(`${packageName}/package.json`);
    const packageDirectory = path.dirname(packageJsonPath);

    if (process.platform === "darwin") {
      prependLibraryPath("DYLD_LIBRARY_PATH", packageDirectory);
    }

    if (process.platform === "linux") {
      prependLibraryPath("LD_LIBRARY_PATH", packageDirectory);
    }
  } catch {
    // Let the real sherpa-onnx-node require path surface the actionable error later.
  }
}

async function loadSherpaOnnxModule() {
  if (!sherpaOnnxModulePromise) {
    sherpaOnnxModulePromise = Promise.resolve().then(() => {
      ensureSherpaLibraryPath();
      return sherpaRequire("sherpa-onnx-node") as SherpaOnnxModule;
    });
  }

  return sherpaOnnxModulePromise;
}

function getRecognizerThreadCount() {
  const configured = Number.parseInt(process.env.HOWCODE_SHERPA_ONNX_NUM_THREADS ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return Math.max(
    1,
    Math.min(
      typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length,
      4,
    ),
  );
}

function buildRecognizerConfig(modelFiles: DictationModelFiles, language: string | null) {
  return {
    featConfig: {
      sampleRate: 16_000,
      featureDim: 80,
    },
    modelConfig: {
      whisper: {
        encoder: modelFiles.encoderPath,
        decoder: modelFiles.decoderPath,
        language: language ?? undefined,
        task: "transcribe",
        tailPaddings: -1,
      },
      tokens: modelFiles.tokensPath,
      numThreads: getRecognizerThreadCount(),
      provider: process.env.HOWCODE_SHERPA_ONNX_PROVIDER?.trim() || "cpu",
      debug: false,
    },
  } satisfies Record<string, unknown>;
}

function buildRecognizerCacheKey(modelFiles: DictationModelFiles, language: string | null) {
  return JSON.stringify({
    encoderPath: modelFiles.encoderPath,
    decoderPath: modelFiles.decoderPath,
    tokensPath: modelFiles.tokensPath,
    language,
  });
}

async function getRecognizer(modelFiles: DictationModelFiles, language: string | null) {
  const cacheKey = buildRecognizerCacheKey(modelFiles, language);
  if (!recognizerCache || recognizerCache.key !== cacheKey) {
    recognizerCache = {
      key: cacheKey,
      promise: loadSherpaOnnxModule().then((sherpaOnnx) =>
        sherpaOnnx.OfflineRecognizer.createAsync(buildRecognizerConfig(modelFiles, language)),
      ),
    };
  }

  return recognizerCache.promise;
}

function buildUnavailableDictationState(
  error: string,
  reason: DictationState["reason"],
): DictationState {
  const [modelDirectory = DEFAULT_DICTATION_MODEL_DIRECTORY] = getDictationModelDirectories();

  return {
    available: false,
    reason,
    runtime: null,
    modelDirectory,
    modelId: null,
    language: null,
    error,
  };
}

function buildUnavailableTranscriptionResult(error: string): DictationTranscriptionResult {
  const [modelDirectory = DEFAULT_DICTATION_MODEL_DIRECTORY] = getDictationModelDirectories();

  return {
    ok: false,
    text: "",
    runtime: null,
    modelDirectory,
    modelId: null,
    language: null,
    error,
  };
}

export function decodeBase64Pcm16Mono(audioBase64: string) {
  return decodePcm16MonoBytes(Buffer.from(audioBase64, "base64"));
}

export async function getDictationState(): Promise<DictationState> {
  if (!getSherpaPlatformPackageName()) {
    return buildUnavailableDictationState(
      "Local dictation is unavailable on this platform.",
      "unsupported-platform",
    );
  }

  const modelFiles = getResolvedDictationModelFiles();
  if (!modelFiles) {
    const [modelDirectory = DEFAULT_DICTATION_MODEL_DIRECTORY] = getDictationModelDirectories();

    return buildUnavailableDictationState(
      `No Whisper model was found. Expected a sherpa-onnx Whisper model under ${modelDirectory}.`,
      "missing-model",
    );
  }

  try {
    await loadSherpaOnnxModule();
  } catch (error) {
    return buildUnavailableDictationState(
      error instanceof Error ? error.message : "Could not load sherpa-onnx-node.",
      "runtime-error",
    );
  }

  return {
    available: true,
    reason: null,
    runtime: "sherpa-onnx-node",
    modelDirectory: modelFiles.modelDirectory,
    modelId: modelFiles.modelId,
    language: modelFiles.language,
    error: null,
  };
}

export async function listDictationModels(): Promise<DictationModelSummary[]> {
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

function buildHuggingFaceResolveUrl(repo: string, fileName: string) {
  return `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(fileName)}?download=true`;
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

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(temporaryPath),
    );
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

export async function installDictationModel(
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
      emitDictationDownloadLog(modelId, `Saved ${fileName}.`);
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

    recognizerCache = null;

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

export async function removeDictationModel(
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
    recognizerCache = null;
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

export async function transcribeDictation(
  request: DictationTranscriptionRequest,
): Promise<DictationTranscriptionResult> {
  const dictationState = await getDictationState();
  if (!dictationState.available) {
    return {
      ok: false,
      text: "",
      runtime: dictationState.runtime,
      modelDirectory: dictationState.modelDirectory,
      modelId: dictationState.modelId,
      language: dictationState.language,
      error: dictationState.error,
    };
  }

  const modelFiles = getResolvedDictationModelFiles();
  if (!modelFiles) {
    return buildUnavailableTranscriptionResult(
      "The configured Whisper model could not be resolved.",
    );
  }

  if (!request.audioBase64.trim()) {
    return {
      ok: false,
      text: "",
      runtime: "sherpa-onnx-node",
      modelDirectory: modelFiles.modelDirectory,
      modelId: modelFiles.modelId,
      language: modelFiles.language,
      error: "No dictation audio was provided.",
    };
  }

  const samples = decodeBase64Pcm16Mono(request.audioBase64);
  if (samples.length === 0) {
    return {
      ok: false,
      text: "",
      runtime: "sherpa-onnx-node",
      modelDirectory: modelFiles.modelDirectory,
      modelId: modelFiles.modelId,
      language: modelFiles.language,
      error: "No speech was captured.",
    };
  }

  const language = normalizeWhisperLanguage(
    process.env.HOWCODE_SHERPA_ONNX_LANGUAGE?.trim() || modelFiles.language || request.language,
  );

  try {
    const recognizer = await getRecognizer(modelFiles, language);
    const stream = recognizer.createStream();
    stream.acceptWaveform({
      samples,
      sampleRate: request.sampleRate,
    });
    const result = await recognizer.decodeAsync(stream);

    return {
      ok: true,
      text: result.text?.trim() ?? "",
      runtime: "sherpa-onnx-node",
      modelDirectory: modelFiles.modelDirectory,
      modelId: modelFiles.modelId,
      language: normalizeWhisperLanguage(result.lang) ?? language,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      runtime: "sherpa-onnx-node",
      modelDirectory: modelFiles.modelDirectory,
      modelId: modelFiles.modelId,
      language,
      error:
        error instanceof Error ? error.message : "Dictation transcription failed unexpectedly.",
    };
  }
}
