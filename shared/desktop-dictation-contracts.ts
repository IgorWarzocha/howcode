export type DictationState = {
  available: boolean;
  reason: "missing-model" | "runtime-error" | "unsupported-platform" | null;
  runtime: "sherpa-onnx-node" | null;
  modelDirectory: string | null;
  modelId: string | null;
  language: string | null;
  error: string | null;
};

export type DictationModelId = "tiny.en" | "base.en" | "small.en";

export type DictationModelSummary = {
  id: DictationModelId;
  name: string;
  description: string;
  downloadSizeBytes: number;
  downloadSizeLabel: string;
  installed: boolean;
  managed: boolean;
  selected: boolean;
};

export type DictationModelInstallResult = {
  ok: boolean;
  modelId: DictationModelId;
  error: string | null;
};

export type DictationModelRemoveResult = {
  ok: boolean;
  modelId: DictationModelId;
  error: string | null;
};

export type DictationTranscriptionRequest = {
  audioBase64: string;
  sampleRate: number;
  language?: string | null;
};

export type DictationTranscriptionResult = {
  ok: boolean;
  text: string;
  runtime: "sherpa-onnx-node" | null;
  modelDirectory: string | null;
  modelId: string | null;
  language: string | null;
  error: string | null;
};
