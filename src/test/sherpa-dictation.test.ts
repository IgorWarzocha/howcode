import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodePcm16MonoBytes,
  inferWhisperLanguage,
  resolveWhisperModelFilesFromFilePaths,
} from "../../shared/dictation-helpers";

describe("sherpa dictation helpers", () => {
  it("infers english from dotted whisper model ids", () => {
    expect(inferWhisperLanguage("tiny.en")).toBe("en");
    expect(inferWhisperLanguage("base.en")).toBe("en");
  });

  it("prefers quantized whisper models when multiple variants are present", () => {
    const rootDirectory = mkdtempSync(path.join(os.tmpdir(), "howcode-whisper-model-"));
    const modelDirectory = path.join(rootDirectory, "tiny-en");
    mkdirSync(modelDirectory, { recursive: true });

    writeFileSync(path.join(modelDirectory, "tiny.en-encoder.onnx"), "");
    writeFileSync(path.join(modelDirectory, "tiny.en-decoder.onnx"), "");
    writeFileSync(path.join(modelDirectory, "tiny.en-encoder.int8.onnx"), "");
    writeFileSync(path.join(modelDirectory, "tiny.en-decoder.int8.onnx"), "");
    writeFileSync(path.join(modelDirectory, "tiny.en-tokens.txt"), "");

    const resolved = resolveWhisperModelFilesFromFilePaths([
      path.join(modelDirectory, "tiny.en-encoder.onnx"),
      path.join(modelDirectory, "tiny.en-decoder.onnx"),
      path.join(modelDirectory, "tiny.en-encoder.int8.onnx"),
      path.join(modelDirectory, "tiny.en-decoder.int8.onnx"),
      path.join(modelDirectory, "tiny.en-tokens.txt"),
    ]);

    expect(resolved).not.toBeNull();
    expect(resolved?.encoderPath).toContain("tiny.en-encoder.int8.onnx");
    expect(resolved?.decoderPath).toContain("tiny.en-decoder.int8.onnx");
    expect(resolved?.language).toBe("en");
  });

  it("decodes base64 pcm16 mono samples into float32 audio", () => {
    const samples = decodePcm16MonoBytes(new Uint8Array([0x00, 0x80, 0x00, 0x00, 0xff, 0x7f]));

    expect(samples.length).toBe(3);
    expect(samples[0]).toBe(-1);
    expect(samples[1]).toBe(0);
    expect(samples[2]).toBeCloseTo(1, 4);
  });
});
