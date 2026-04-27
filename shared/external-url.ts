const safeExternalProtocols = new Set(["http:", "https:"]);

function normalizeExternalUrl(value: string) {
  return value.replace(/^git\+/, "");
}

export function getSafeExternalUrl(url: string | null | undefined) {
  if (typeof url !== "string") {
    return null;
  }

  const normalizedUrl = normalizeExternalUrl(url.trim());
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return safeExternalProtocols.has(parsedUrl.protocol) ? parsedUrl.href : null;
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(url: string | null | undefined) {
  return getSafeExternalUrl(url) !== null;
}

export function pickSafeExternalUrl(urls: Array<string | null | undefined>) {
  for (const url of urls) {
    const safeUrl = getSafeExternalUrl(url);
    if (safeUrl) {
      return safeUrl;
    }
  }

  return null;
}
