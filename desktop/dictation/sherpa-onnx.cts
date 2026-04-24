import type {
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
} from "../../shared/desktop-contracts.ts";
import { decodePcm16MonoBytes, normalizeWhisperLanguage } from "../../shared/dictation-helpers.ts";
import {
  DEFAULT_DICTATION_MODEL_DIRECTORY,
  getDictationModelDirectories,
  getResolvedDictationModelFiles,
} from "./model-resolution.cts";
import {
  getRecognizer,
  getSherpaPlatformPackageName,
  loadSherpaOnnxModule,
} from "./sherpa-runtime.cts";
export {
  installManagedDictationModel as installDictationModel,
  listManagedAndConfiguredDictationModels as listDictationModels,
  removeManagedDictationModel as removeDictationModel,
} from "./model-management.cts";

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
