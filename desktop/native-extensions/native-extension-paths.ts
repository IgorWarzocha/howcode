import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type HowcodeNativeExtensionId = 'askQuestions' | 'smartBtw'

const nativeExtensionFiles = {
  askQuestions: 'howcode-native-ask-questions.ts',
  smartBtw: 'howcode-native-smart-btw.mjs',
} satisfies Record<HowcodeNativeExtensionId, string>

export const howcodeNativeExtensionIds = Object.keys(
  nativeExtensionFiles,
) as HowcodeNativeExtensionId[]

export function getBundledNativeExtensionPath(id: HowcodeNativeExtensionId) {
  const extensionFileName = nativeExtensionFiles[id]
  const candidates = [
    fileURLToPath(new URL(`./native-extensions/${extensionFileName}`, import.meta.url)),
    fileURLToPath(new URL(`./${extensionFileName}`, import.meta.url)),
  ]

  return (
    candidates.find((candidate) => existsSync(candidate)) ?? candidates.at(-1) ?? extensionFileName
  )
}

export function ensureNativeExtensionRuntimePath(id: HowcodeNativeExtensionId) {
  return getBundledNativeExtensionPath(id)
}

export function getNativeExtensionRuntimePaths(ids: readonly string[]) {
  return ids
    .filter((id): id is HowcodeNativeExtensionId =>
      howcodeNativeExtensionIds.includes(id as HowcodeNativeExtensionId),
    )
    .filter((id) => id !== 'askQuestions')
    .map((id) => ensureNativeExtensionRuntimePath(id))
}
