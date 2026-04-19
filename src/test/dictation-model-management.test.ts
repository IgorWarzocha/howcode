import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchDownloadResponse,
  getDownloadChecksumExpectations,
} from "../../desktop/dictation/model-download";

function contentMatchesChecksum(content: string, etag: string) {
  return getDownloadChecksumExpectations(etag, Buffer.byteLength(content)).some((expectation) => {
    const hash = createHash(expectation.algorithm);
    if (expectation.prefix) {
      hash.update(expectation.prefix);
    }

    hash.update(content);
    return hash.digest("hex") === expectation.expected;
  });
}

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
      etagSource: "x-linked-etag",
    });
    await expect(response.text()).resolves.toBe(fileContents);
  });

  it("uses the final response content length when redirects only expose redirect body sizes", async () => {
    const fileContents = "token-1\ntoken-2\n";
    const expectedChecksum = createHash("sha1").update(fileContents).digest("hex");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: {
            location: "https://huggingface.co/api/resolve-cache/models/repo/revision/model.txt",
            "content-length": "227",
            "x-linked-etag": `"${expectedChecksum}"`,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(fileContents, {
          status: 200,
          headers: {
            etag: `W/\"${expectedChecksum}\"`,
            "content-length": String(fileContents.length),
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { metadata } = await fetchDownloadResponse(
      "https://huggingface.co/repo/resolve/main/model.txt?download=true",
    );

    expect(metadata).toEqual({
      contentLength: fileContents.length,
      etag: expectedChecksum,
      etagSource: "x-linked-etag",
    });
  });

  it("ignores early non-hash etags and keeps later hash metadata", async () => {
    const fileContents = "tiny whisper model";
    const expectedChecksum = createHash("sha256").update(fileContents).digest("hex");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://huggingface.co/redirect-2",
            etag: '"not-a-content-hash"',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://download.example.test/model.onnx",
            "x-linked-etag": `"${expectedChecksum}"`,
            "x-linked-size": String(fileContents.length),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(fileContents, {
          status: 200,
          headers: {
            etag: '"another-non-hash-etag"',
            "content-length": String(fileContents.length),
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { metadata } = await fetchDownloadResponse(
      "https://huggingface.co/repo/resolve/main/model.onnx?download=true",
    );

    expect(metadata).toEqual({
      contentLength: fileContents.length,
      etag: expectedChecksum,
      etagSource: "x-linked-etag",
    });
  });

  it("prefers later x-linked etags over earlier plain etags", async () => {
    const fileContents = "tiny whisper model";
    const earlyChecksum = createHash("sha256").update("redirect checksum").digest("hex");
    const linkedChecksum = createHash("sha256").update(fileContents).digest("hex");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://huggingface.co/redirect-2",
            etag: `"${earlyChecksum}"`,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://download.example.test/model.onnx",
            "x-linked-etag": `"${linkedChecksum}"`,
            "x-linked-size": String(fileContents.length),
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(fileContents, {
          status: 200,
          headers: {
            etag: `"${earlyChecksum}"`,
            "content-length": String(fileContents.length),
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { metadata } = await fetchDownloadResponse(
      "https://huggingface.co/repo/resolve/main/model.onnx?download=true",
    );

    expect(metadata).toEqual({
      contentLength: fileContents.length,
      etag: linkedChecksum,
      etagSource: "x-linked-etag",
    });
  });

  it("allows longer redirect chains before failing", async () => {
    const fileContents = "token-1\ntoken-2\n";
    const expectedChecksum = createHash("sha1").update(fileContents).digest("hex");
    const fetchMock = vi.fn();

    for (let index = 0; index < 6; index += 1) {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: `https://huggingface.co/redirect-${index + 1}`,
            ...(index === 5
              ? {
                  "x-linked-etag": `"${expectedChecksum}"`,
                }
              : {}),
          },
        }),
      );
    }

    fetchMock.mockResolvedValueOnce(
      new Response(fileContents, {
        status: 200,
        headers: {
          etag: `W/\"${expectedChecksum}\"`,
          "content-length": String(fileContents.length),
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { metadata } = await fetchDownloadResponse(
      "https://huggingface.co/repo/resolve/main/model.txt?download=true",
    );

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(metadata).toEqual({
      contentLength: fileContents.length,
      etag: expectedChecksum,
      etagSource: "x-linked-etag",
    });
  });

  it("accepts Hugging Face git-blob sha1 etags for plain repository files", () => {
    const fileContents = "token-1\ntoken-2\n";
    const gitBlobSha1 = createHash("sha1")
      .update(`blob ${Buffer.byteLength(fileContents)}\0`)
      .update(fileContents)
      .digest("hex");

    expect(contentMatchesChecksum(fileContents, gitBlobSha1)).toBe(true);
  });

  it("accepts raw sha256 etags for xet-backed model files", () => {
    const fileContents = "model-binary";
    const sha256 = createHash("sha256").update(fileContents).digest("hex");

    expect(contentMatchesChecksum(fileContents, sha256)).toBe(true);
  });
});
