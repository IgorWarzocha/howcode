export function appendPiSettingsWrite<T>(
  queue: Promise<unknown>,
  write: () => Promise<T>,
): Promise<T> {
  return queue
    .catch(() => {
      // A failed write must not prevent later settings from reaching Pi.
    })
    .then(write)
}
