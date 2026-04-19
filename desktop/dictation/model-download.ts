import { Buffer } from "node:buffer";

export type DownloadMetadata = {
  contentLength: number | null;
  etag: string | null;
};

export type DownloadChecksumExpectation = {
  algorithm: "sha1" | "sha256";
  expected: string;
  prefix: Buffer | null;
};

const MAX_DOWNLOAD_REDIRECTS = 5;

function normalizeEtag(etag: string | null) {
  if (!etag) {
    return null;
  }

  return etag.replace(/^W\//, "").replace(/^"|"$/g, "").trim().toLowerCase() || null;
}

function parseContentLength(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getDownloadMetadataFromHeaders(headers: Headers): DownloadMetadata {
  return {
    contentLength: parseContentLength(headers.get("x-linked-size")),
    etag: normalizeEtag(headers.get("x-linked-etag")) ?? normalizeEtag(headers.get("etag")),
  };
}

export function getDownloadChecksumExpectations(
  etag: string | null,
  contentLength: number,
): DownloadChecksumExpectation[] {
  if (!etag) {
    return [];
  }

  if (/^[a-f0-9]{64}$/i.test(etag)) {
    return [{ algorithm: "sha256", expected: etag, prefix: null }];
  }

  if (/^[a-f0-9]{40}$/i.test(etag)) {
    return [
      { algorithm: "sha1", expected: etag, prefix: null },
      {
        algorithm: "sha1",
        expected: etag,
        prefix: Buffer.from(`blob ${contentLength}\0`),
      },
    ];
  }

  return [];
}

function mergeDownloadMetadata(
  current: DownloadMetadata,
  headers: Headers,
  options: { includeContentLength: boolean },
): DownloadMetadata {
  const next = getDownloadMetadataFromHeaders(headers);
  const fallbackContentLength = options.includeContentLength
    ? parseContentLength(headers.get("content-length"))
    : null;

  return {
    contentLength: current.contentLength ?? next.contentLength ?? fallbackContentLength,
    etag: current.etag ?? next.etag,
  };
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchDownloadResponse(url: string) {
  let currentUrl = url;
  let metadata: DownloadMetadata = {
    contentLength: null,
    etag: null,
  };

  for (let redirectCount = 0; redirectCount <= MAX_DOWNLOAD_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, { redirect: "manual" });
    metadata = mergeDownloadMetadata(metadata, response.headers, {
      includeContentLength: !isRedirectStatus(response.status),
    });

    if (!isRedirectStatus(response.status)) {
      if (!response.ok) {
        throw new Error(
          `Download failed (${response.status} ${response.statusText}) for ${currentUrl}`,
        );
      }

      return {
        response,
        metadata,
      };
    }

    if (redirectCount === MAX_DOWNLOAD_REDIRECTS) {
      throw new Error(`Download failed: too many redirects for ${url}`);
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`Download failed: missing redirect location for ${currentUrl}`);
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`Download failed: could not resolve ${url}`);
}
