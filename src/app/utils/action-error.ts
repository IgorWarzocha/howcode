export function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
