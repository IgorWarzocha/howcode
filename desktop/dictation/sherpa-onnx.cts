import { existsSync, readdirSync, type Dirent } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type {
  DictationModelId,
  DictationModelInstallResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
} from "../../shared/desktop-contracts.ts";
import {
  decodePcm16MonoBytes,
  normalizeWhisperLanguage,
  resolveWhisperModelFilesFromFilePaths,
  type ResolvedWhisperModelFiles,
} from "../../shared/dictation-helpers.ts";
import {
  dictationModelDefinitions,
  getDictationModelDefinition,
  getDictationModelDownloadSizeLabel,
} from "../../shared/dictation-models.ts";
import { loadAppSettings } from "../app-settings.cts";
import { emitDesktopEvent } from "../runtime/desktop-events.cts";
import { getDesktopUserDataPath } from "../user-data-path.cts";

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

type DictationModelFiles = ResolvedWhisperModelFiles;

const DEFAULT_DICTATION_MODEL_DIRECTORY = path.join(getDesktopUserDataPath(), "models", "whisper");
const DICTATION_MODEL_DIR_ENV_KEYS = [
  "HOWCODE_SHERPA_ONNX_MODEL_DIR",
  "HOWCODE_DICTATION_MODEL_DIR",
] as const;

const sherpaRequire = createRequire(import.meta.url);

let sherpaOnnxModulePromise: Promise<SherpaOnnxModule> | null = null;
let recognizerCache: {
  key: string;
  promise: Promise<SherpaOfflineRecognizer>;
} | null = null;

function getDictationModelsRootDirectory() {
  const [modelDirectory = DEFAULT_DICTATION_MODEL_DIRECTORY] = getDictationModelDirectories();
  return modelDirectory;
}

function getDictationModelDirectory(modelId: DictationModelId) {
  return path.join(getDictationModelsRootDirectory(), modelId);
}

function getResolvedModelFilesForDefinition(modelId: DictationModelId): DictationModelFiles | null {
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

function getInstalledDictationModelFiles() {
  return dictationModelDefinitions.flatMap((definition) => {
    const modelFiles = getResolvedModelFilesForDefinition(definition.id);
    return modelFiles ? [modelFiles] : [];
  });
}

function getSelectedInstalledDictationModelFiles() {
  const appSettings = loadAppSettings();
  const selectedModelId = appSettings.dictationModelId;
  const selectedModelFiles = selectedModelId
    ? getResolvedModelFilesForDefinition(selectedModelId)
    : null;

  if (selectedModelFiles) {
    return selectedModelFiles;
  }

  return getInstalledDictationModelFiles()[0] ?? null;
}

function findConfiguredDictationModelFiles(modelId?: DictationModelId) {
  for (const directoryPath of getDictationModelDirectories()) {
    const modelFiles = resolveWhisperModelFilesFromDirectory(directoryPath);
    if (!modelFiles) {
      continue;
    }

    if (!modelId || modelFiles.modelId === modelId) {
      return modelFiles;
    }
  }

  return null;
}

function getDictationModelDirectories() {
  const configuredDirectories = DICTATION_MODEL_DIR_ENV_KEYS.map((key) =>
    process.env[key]?.trim(),
  ).filter((value): value is string => Boolean(value));

  return [...new Set([...configuredDirectories, DEFAULT_DICTATION_MODEL_DIRECTORY])];
}

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

export function resolveWhisperModelFilesFromDirectory(
  directoryPath: string,
): DictationModelFiles | null {
  if (!existsSync(directoryPath)) {
    return null;
  }

  return resolveWhisperModelFilesFromFilePaths(collectCandidateFiles(directoryPath));
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

function getResolvedDictationModelFiles() {
  return getSelectedInstalledDictationModelFiles() ?? findConfiguredDictationModelFiles();
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
    const installed =
      getResolvedModelFilesForDefinition(definition.id) !== null ||
      findConfiguredDictationModelFiles(definition.id) !== null;

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      downloadSizeBytes: definition.downloadSizeBytes,
      downloadSizeLabel: getDictationModelDownloadSizeLabel(definition.downloadSizeBytes),
      installed,
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

  const temporaryPath = `${targetPath}.partial`;
  await Bun.write(temporaryPath, response);
  await rename(temporaryPath, targetPath);
}

function createDictationDownloadStagePath(modelId: DictationModelId) {
  return path.join(
    getDictationModelsRootDirectory(),
    `.${modelId}.download-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
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
    await mkdir(modelDirectory, { recursive: true });

    for (const fileName of downloadedFiles) {
      const targetPath = path.join(modelDirectory, fileName);
      await rm(targetPath, { force: true });
      await rename(path.join(stagingDirectory, fileName), targetPath);
    }

    await rm(stagingDirectory, { recursive: true, force: true });

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
    process.env.HOWCODE_SHERPA_ONNX_LANGUAGE?.trim() || request.language || modelFiles.language,
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
