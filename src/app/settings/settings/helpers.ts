import type { DesktopActionResult, DesktopSettingsUpdatePayload } from '../../desktop/types'

export function getActionError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === 'string' ? result.result.error : null
}

export function buildModelSelectionPayload(id: string): DesktopSettingsUpdatePayload {
  const key = 'defaultModel'
  if (id === 'composer-default') {
    return { key, reset: true }
  }

  const [provider, ...modelIdParts] = id.split('/')
  const modelId = modelIdParts.join('/')

  if (!provider) {
    return { key, reset: true }
  }

  return { key, provider, modelId }
}
