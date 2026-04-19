import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDownloadResponse } from "../../desktop/dictation/model-download";

describe("dictation model download metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prefers Hugging Face x-linked checksum metadata over redirected etags", async () => {
    const fileContents = "tiny whisper model";
    const expectedChecksum = createHash("sha256").update(fileContents).digest("hex");
    const redirectedChecksum = createHash("sha256").update("redirect-metadata").digest("hex");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://download.example.test/tiny.en-encoder.int8.onnx",
            "x-linked-etag": `"${expectedChecksum}"`,
            "x-linked-size": String(fileContents.length),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(fileContents, {
          status: 200,
          headers: {
            etag: `"${redirectedChecksum}"`,
            "content-length": String(fileContents.length),
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { response, metadata } = await fetchDownloadResponse(
      "https://huggingface.co/repo/resolve/main/model.onnx?download=true",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://huggingface.co/repo/resolve/main/model.onnx?download=true",
      { redirect: "manual" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://download.example.test/tiny.en-encoder.int8.onnx",
      { redirect: "manual" },
    );
    expect(metadata).toEqual({
      contentLength: fileContents.length,
      etag: expectedChecksum,
    });
    await expect(response.text()).resolves.toBe(fileContents);
  });
});
