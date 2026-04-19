export type DownloadMetadata = {
  contentLength: number | null;
  etag: string | null;
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
    contentLength:
      parseContentLength(headers.get("x-linked-size")) ??
      parseContentLength(headers.get("content-length")),
    etag: normalizeEtag(headers.get("x-linked-etag")) ?? normalizeEtag(headers.get("etag")),
  };
}

function mergeDownloadMetadata(current: DownloadMetadata, headers: Headers): DownloadMetadata {
  const next = getDownloadMetadataFromHeaders(headers);

  return {
    contentLength: current.contentLength ?? next.contentLength,
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
    metadata = mergeDownloadMetadata(metadata, response.headers);

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
