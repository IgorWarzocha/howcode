import type { DesktopActionResult, DesktopSettingsUpdatePayload } from '../../desktop/types'

export function getActionError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === 'string' ? result.result.error : null
}

export function buildModelSelectionPayload(
  key: 'chatModel' | 'codeModel' | 'gitCommitMessageModel',
  id: string,
): DesktopSettingsUpdatePayload {
  if (id === 'composer-default') {
    return { key, reset: true }
  }

  const [provider, ...modelIdParts] = id.split('/')
  const modelId = modelIdParts.join('/')

  if (!provider) {
    return { key, reset: true }
  }

  if (key === 'chatModel') {
    return {
      key,
      provider,
      modelId,
    }
  }

  if (key === 'codeModel') {
    return {
      key,
      provider,
      modelId,
    }
  }

  if (key === 'gitCommitMessageModel') {
    return {
      key,
      provider,
      modelId,
    }
  }

  return {
    key,
    provider,
    modelId,
  }
}

export function getDirectoryImportSummaryMessage(result: DesktopActionResult | null) {
  const checkedDirectoryCount =
    typeof result?.result?.checkedDirectoryCount === 'number'
      ? result.result.checkedDirectoryCount
      : 0
  const originDirectoryCount =
    typeof result?.result?.originDirectoryCount === 'number'
      ? result.result.originDirectoryCount
      : 0

  return checkedDirectoryCount > 0
    ? `Scanned ${checkedDirectoryCount} · Found ${originDirectoryCount} origins`
    : 'Nothing to scan'
}
