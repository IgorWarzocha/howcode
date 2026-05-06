function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}
export function getDesktopWorkingDirectory() {
  return getProcessEnvironmentVariable('HOWCODE_REPO_ROOT') || process.cwd()
}
