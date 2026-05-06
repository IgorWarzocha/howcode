import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const extensionFileName = 'howcode-native-ask-questions.mjs'

export function getBundledAskQuestionsExtensionPath() {
  const candidates = [
    fileURLToPath(new URL(`./native-extensions/${extensionFileName}`, import.meta.url)),
    fileURLToPath(new URL(`./${extensionFileName}`, import.meta.url)),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1]
}

export function ensureAskQuestionsExtensionRuntimePath() {
  return getBundledAskQuestionsExtensionPath()
}
