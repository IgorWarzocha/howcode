import type { DictationModelId } from "./desktop-contracts";

export type DictationModelDefinition = {
  id: DictationModelId;
  name: string;
  description: string;
  huggingFaceRepo: string;
  downloadSizeBytes: number;
  files: {
    encoder: string;
    decoder: string;
    tokens: string;
  };
};

function formatDownloadSize(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export const dictationModelDefinitions: DictationModelDefinition[] = [
  {
    id: "tiny.en",
    name: "Tiny English",
    description: "Fastest and smallest Whisper model for quick dictation.",
    huggingFaceRepo: "csukuangfj/sherpa-onnx-whisper-tiny.en",
    downloadSizeBytes: 103_627_191,
    files: {
      encoder: "tiny.en-encoder.int8.onnx",
      decoder: "tiny.en-decoder.int8.onnx",
      tokens: "tiny.en-tokens.txt",
    },
  },
  {
    id: "base.en",
    name: "Base English",
    description: "Balanced default with better accuracy at moderate download size.",
    huggingFaceRepo: "csukuangfj/sherpa-onnx-whisper-base.en",
    downloadSizeBytes: 160_626_066,
    files: {
      encoder: "base.en-encoder.int8.onnx",
      decoder: "base.en-decoder.int8.onnx",
      tokens: "base.en-tokens.txt",
    },
  },
  {
    id: "small.en",
    name: "Small English",
    description: "Highest accuracy of the initial presets, with the biggest download.",
    huggingFaceRepo: "csukuangfj/sherpa-onnx-whisper-small.en",
    downloadSizeBytes: 375_501_079,
    files: {
      encoder: "small.en-encoder.int8.onnx",
      decoder: "small.en-decoder.int8.onnx",
      tokens: "small.en-tokens.txt",
    },
  },
];

export function getDictationModelDefinition(modelId: DictationModelId) {
  return dictationModelDefinitions.find((model) => model.id === modelId) ?? null;
}

export function getDictationModelDownloadSizeLabel(bytes: number) {
  return formatDownloadSize(bytes);
}
