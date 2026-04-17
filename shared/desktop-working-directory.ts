export function getDesktopWorkingDirectory() {
  return process.env.HOWCODE_REPO_ROOT || process.cwd();
}
