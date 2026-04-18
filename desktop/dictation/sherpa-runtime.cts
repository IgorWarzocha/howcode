import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type { DictationModelFiles } from "./model-resolution.cts";

type SherpaOfflineStream = {
  acceptWaveform: (input: { samples: Float32Array; sampleRate: number }) => void;
};

type SherpaOfflineRecognizerResult = {
  lang?: string;
  text?: string;
};

export type SherpaOfflineRecognizer = {
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

export function getSherpaPlatformPackageName() {
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

export async function loadSherpaOnnxModule() {
  if (!sherpaOnnxModulePromise) {
    sherpaOnnxModulePromise = Promise.resolve()
      .then(() => {
        ensureSherpaLibraryPath();
        return sherpaRequire("sherpa-onnx-node") as SherpaOnnxModule;
      })
      .catch((error) => {
        sherpaOnnxModulePromise = null;
        throw error;
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

export async function getRecognizer(modelFiles: DictationModelFiles, language: string | null) {
  const cacheKey = buildRecognizerCacheKey(modelFiles, language);
  if (!recognizerCache || recognizerCache.key !== cacheKey) {
    const promise = loadSherpaOnnxModule()
      .then((sherpaOnnx) =>
        sherpaOnnx.OfflineRecognizer.createAsync(buildRecognizerConfig(modelFiles, language)),
      )
      .catch((error) => {
        if (recognizerCache?.key === cacheKey) {
          recognizerCache = null;
        }

        throw error;
      });

    recognizerCache = {
      key: cacheKey,
      promise,
    };
  }

  return recognizerCache.promise;
}

export function resetRecognizerCache() {
  recognizerCache = null;
}
