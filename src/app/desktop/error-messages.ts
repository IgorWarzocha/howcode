const ELECTRON_REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*/i;

function stripKnownWrappers(message: string) {
  let next = message.trim().replace(ELECTRON_REMOTE_ERROR_PREFIX, "");

  const lastErrorIndex = next.lastIndexOf("Error:");
  if (lastErrorIndex >= 0) {
    next = next.slice(lastErrorIndex + "Error:".length).trim();
  }

  return next;
}

export function cleanUserErrorMessage(
  message: string | null | undefined,
  fallback = "Something went wrong.",
) {
  if (!message) {
    return fallback;
  }

  const cleaned = stripKnownWrappers(message).replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return cleanUserErrorMessage(error instanceof Error ? error.message : null, fallback);
}
