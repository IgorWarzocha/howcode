import path from "node:path";

export type ResolvedWhisperModelFiles = {
  modelDirectory: string;
  encoderPath: string;
  decoderPath: string;
  tokensPath: string;
  modelId: string;
  language: string | null;
};

export function inferWhisperLanguage(modelId: string) {
  return /(^|[._-])en($|[._-])/.test(modelId) ? "en" : null;
}

export function normalizeWhisperLanguage(language: string | null | undefined) {
  if (!language) {
    return null;
  }

  const normalized = language.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const primarySubtag = normalized.split(/[-_]/)[0]?.trim();
  return primarySubtag || null;
}

export function resolveWhisperModelFilesFromFilePaths(
  filePaths: string[],
): ResolvedWhisperModelFiles | null {
  const filesByDirectory = new Map<string, Set<string>>();

  for (const filePath of filePaths) {
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const entrySet = filesByDirectory.get(directory) ?? new Set<string>();
    entrySet.add(fileName);
    filesByDirectory.set(directory, entrySet);
  }

  const encoderCandidates = filePaths
    .map((filePath) => {
      const match = path.basename(filePath).match(/^(.*)-encoder(\.int8)?\.onnx$/);
      if (!match) {
        return null;
      }

      return {
        filePath,
        directory: path.dirname(filePath),
        modelId: match[1],
        quantized: Boolean(match[2]),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => Number(right.quantized) - Number(left.quantized));

  for (const candidate of encoderCandidates) {
    const directoryFiles = filesByDirectory.get(candidate.directory);
    if (!directoryFiles) {
      continue;
    }

    const decoderFileName = [
      `${candidate.modelId}-decoder.int8.onnx`,
      `${candidate.modelId}-decoder.onnx`,
    ].find((fileName) => directoryFiles.has(fileName));
    const tokensFileName = `${candidate.modelId}-tokens.txt`;

    if (!decoderFileName || !directoryFiles.has(tokensFileName)) {
      continue;
    }

    return {
      modelDirectory: candidate.directory,
      encoderPath: candidate.filePath,
      decoderPath: path.join(candidate.directory, decoderFileName),
      tokensPath: path.join(candidate.directory, tokensFileName),
      modelId: candidate.modelId,
      language: inferWhisperLanguage(candidate.modelId),
    };
  }

  return null;
}

export function decodePcm16MonoBytes(bytes: Uint8Array) {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const lowByte = bytes[index * 2] ?? 0;
    const highByte = bytes[index * 2 + 1] ?? 0;
    let sample = (highByte << 8) | lowByte;

    if (sample & 0x8000) {
      sample -= 0x1_0000;
    }

    samples[index] = sample === -32_768 ? -1 : sample / 32_767;
  }

  return samples;
}
