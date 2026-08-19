import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getSystemTarPath() {
  const candidates =
    process.platform === 'win32' ? getWindowsTarCandidates() : getUnixTarCandidates()
  const executablePath = candidates.find((candidate) => {
    try {
      accessSync(candidate, constants.X_OK)
      return true
    } catch {
      return false
    }
  })
  if (!executablePath) {
    throw new Error(`Could not find the system tar executable. Checked ${candidates.join(', ')}.`)
  }
  return executablePath
}

function getWindowsTarCandidates() {
  return [
    path.join(
      getProcessEnvironmentVariable('SystemRoot') ??
        getProcessEnvironmentVariable('SYSTEMROOT') ??
        'C:\\Windows',
      'System32',
      'tar.exe',
    ),
  ]
}

function getUnixTarCandidates() {
  const pathCandidates = (getProcessEnvironmentVariable('PATH') ?? '')
    .split(path.delimiter)
    .filter((entry) => path.isAbsolute(entry))
    .map((entry) => path.join(entry, 'tar'))
  return [...new Set(['/usr/bin/tar', '/bin/tar', ...pathCandidates])]
}

export async function extractUpdateArchive(archivePath: string, destinationPath: string) {
  // Electron's fs shim treats an output path ending in app.asar as an archive. Extract out of
  // process so the packaged app bundle is written as an ordinary file.
  await execFileAsync(getSystemTarPath(), ['-xzf', archivePath, '-C', destinationPath], {
    windowsHide: true,
  })
}
