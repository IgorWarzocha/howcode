export function getRelaunchArguments(argv: readonly string[], isPackaged: boolean) {
  // Development argv includes the Electron app entrypoint; packaged argv does not.
  return argv.slice(isPackaged ? 1 : 2)
}

export function shouldTakeoverAtStartup(headlessEnabled: boolean) {
  return !headlessEnabled
}
