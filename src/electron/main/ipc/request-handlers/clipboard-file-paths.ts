import { fileURLToPath } from 'node:url'

const uriListLineSeparator = /\r?\n/u

export function parseClipboardFilePaths(uriList: string): string[] {
  const paths = new Set<string>()
  for (const line of uriList.split(uriListLineSeparator)) {
    const uri = line.trim()
    if (!uri || uri.startsWith('#')) continue
    try {
      const url = new URL(uri)
      if (url.protocol !== 'file:') continue
      const filePath = fileURLToPath(url)
      if (!filePath.includes('\0')) paths.add(filePath)
    } catch {
      // A malformed entry must not discard other files in the same URI list.
    }
  }
  return [...paths]
}
