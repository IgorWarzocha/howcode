import { defaultPiSettings } from '../../shared/default-pi-settings.ts'
import type { PiSettings } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { getPiModule } from '../pi-module.ts'
import { markRuntimeSettingsStaleForProject } from '../runtime/runtime-registry.ts'
import { loadPiThemeStateInHost } from './theme-service.ts'

export type PiSettingsKey = keyof PiSettings

type PiSettingsManager = Awaited<ReturnType<typeof getPiSettingsManager>>

async function getPiSettingsManager(projectPath?: string | undefined | null | undefined) {
  const { SettingsManager, getAgentDir } = await getPiModule()
  return SettingsManager.create(projectPath ?? getDesktopWorkingDirectory(), getAgentDir())
}

export async function getPiSessionStorage(projectPath?: string | undefined | null | undefined) {
  const { SettingsManager, SessionManager, getAgentDir } = await getPiModule()
  const cwd = projectPath ?? getDesktopWorkingDirectory()
  const agentDir = getAgentDir()
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const configuredSessionDir = settingsManager.getSessionDir()

  return {
    agentDir,
    sessionDir: configuredSessionDir ?? SessionManager.create(cwd).getSessionDir(),
  }
}

export async function loadPiSettingsInHost(
  projectPath?: string | undefined | null | undefined,
): Promise<PiSettings> {
  const settingsManager = await getPiSettingsManager(projectPath)
  return {
    theme: settingsManager.getTheme() ?? defaultPiSettings.theme,
    autoCompact: settingsManager.getCompactionEnabled(),
    enableSkillCommands: settingsManager.getEnableSkillCommands(),
    hideThinkingBlock: settingsManager.getHideThinkingBlock(),
    quietStartup: settingsManager.getQuietStartup(),
    showImages: settingsManager.getShowImages(),
    autoResizeImages: settingsManager.getImageAutoResize(),
    blockImages: settingsManager.getBlockImages(),
    collapseChangelog: settingsManager.getCollapseChangelog(),
    enableInstallTelemetry: settingsManager.getEnableInstallTelemetry(),
    showHardwareCursor: settingsManager.getShowHardwareCursor(),
    clearOnShrink: settingsManager.getClearOnShrink(),
    transport: asPiTransport(settingsManager.getTransport()) ?? defaultPiSettings.transport,
    steeringMode:
      asPiQueueMode(settingsManager.getSteeringMode()) ?? defaultPiSettings.steeringMode,
    followUpMode:
      asPiQueueMode(settingsManager.getFollowUpMode()) ?? defaultPiSettings.followUpMode,
    doubleEscapeAction:
      asPiDoubleEscapeAction(settingsManager.getDoubleEscapeAction()) ??
      defaultPiSettings.doubleEscapeAction,
    treeFilterMode:
      asPiTreeFilterMode(settingsManager.getTreeFilterMode()) ?? defaultPiSettings.treeFilterMode,
    editorPaddingX: settingsManager.getEditorPaddingX(),
    autocompleteMaxVisible: settingsManager.getAutocompleteMaxVisible(),
    imageWidthCells: settingsManager.getImageWidthCells(),
  }
}

function asPiTransport(value: unknown): PiSettings['transport'] | null {
  return value === 'sse' || value === 'websocket' || value === 'auto' ? value : null
}

function asPiQueueMode(value: unknown): PiSettings['steeringMode'] | null {
  return value === 'all' || value === 'one-at-a-time' ? value : null
}

function asPiDoubleEscapeAction(value: unknown): PiSettings['doubleEscapeAction'] | null {
  return value === 'fork' || value === 'tree' || value === 'none' ? value : null
}

function asPiTreeFilterMode(value: unknown): PiSettings['treeFilterMode'] | null {
  return value === 'default' ||
    value === 'no-tools' ||
    value === 'user-only' ||
    value === 'labeled-only' ||
    value === 'all'
    ? value
    : null
}

function asBoundedInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : null
}

function updateBooleanSetting(
  settingsManager: PiSettingsManager,
  key: PiSettingsKey,
  value: unknown,
) {
  if (typeof value !== 'boolean') return false
  switch (key) {
    case 'autoCompact':
      settingsManager.setCompactionEnabled(value)
      return true
    case 'enableSkillCommands':
      settingsManager.setEnableSkillCommands(value)
      return true
    case 'hideThinkingBlock':
      settingsManager.setHideThinkingBlock(value)
      return true
    case 'quietStartup':
      settingsManager.setQuietStartup(value)
      return true
    case 'showImages':
      settingsManager.setShowImages(value)
      return true
    case 'autoResizeImages':
      settingsManager.setImageAutoResize(value)
      return true
    case 'blockImages':
      settingsManager.setBlockImages(value)
      return true
    case 'collapseChangelog':
      settingsManager.setCollapseChangelog(value)
      return true
    case 'enableInstallTelemetry':
      settingsManager.setEnableInstallTelemetry(value)
      return true
    case 'showHardwareCursor':
      settingsManager.setShowHardwareCursor(value)
      return true
    case 'clearOnShrink':
      settingsManager.setClearOnShrink(value)
      return true
    default:
      return false
  }
}

async function isKnownTheme(
  themeName: string,
  projectPath?: string | undefined | null | undefined,
) {
  const themeState = await loadPiThemeStateInHost(projectPath)
  return themeState.themes.some((theme) => theme.name === themeName)
}

async function updateThemeSetting(
  settingsManager: PiSettingsManager,
  value: unknown,
  projectPath?: string | null | undefined,
) {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  const theme = value.trim()
  if (!(await isKnownTheme(theme, projectPath))) throw new Error(`Unknown Pi theme: ${theme}`)
  settingsManager.setTheme(theme)
  return true
}

function updateTransportSetting(settingsManager: PiSettingsManager, value: unknown) {
  const transport = asPiTransport(value)
  if (!transport) return false
  settingsManager.setTransport(transport)
  return true
}

function updateQueueModeSetting(
  settingsManager: PiSettingsManager,
  key: PiSettingsKey,
  value: unknown,
) {
  if (!(key === 'steeringMode' || key === 'followUpMode')) return false
  const mode = asPiQueueMode(value)
  if (!mode) return false
  if (key === 'steeringMode') settingsManager.setSteeringMode(mode)
  else settingsManager.setFollowUpMode(mode)
  return true
}

function updateBoundedIntegerSetting(
  settingsManager: PiSettingsManager,
  key: PiSettingsKey,
  value: unknown,
) {
  if (key === 'editorPaddingX') {
    const padding = asBoundedInteger(value, 0, 3)
    if (padding === null) return false
    settingsManager.setEditorPaddingX(padding)
    return true
  }
  if (key === 'autocompleteMaxVisible') {
    const maxVisible = asBoundedInteger(value, 3, 20)
    if (maxVisible === null) return false
    settingsManager.setAutocompleteMaxVisible(maxVisible)
    return true
  }
  if (key !== 'imageWidthCells') return false
  const width = asBoundedInteger(value, 1, 200)
  if (width === null) return false
  settingsManager.setImageWidthCells(width)
  return true
}

async function updateNonBooleanSetting(
  settingsManager: PiSettingsManager,
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | null | undefined,
) {
  if (key === 'theme') return await updateThemeSetting(settingsManager, value, projectPath)
  if (key === 'transport') return updateTransportSetting(settingsManager, value)
  if (updateQueueModeSetting(settingsManager, key, value)) return true
  if (key === 'doubleEscapeAction') {
    const action = asPiDoubleEscapeAction(value)
    if (!action) return false
    settingsManager.setDoubleEscapeAction(action)
    return true
  }
  if (key === 'treeFilterMode') {
    const mode = asPiTreeFilterMode(value)
    if (!mode) return false
    settingsManager.setTreeFilterMode(mode)
    return true
  }
  return updateBoundedIntegerSetting(settingsManager, key, value)
}

export async function updatePiSettingInHost(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | undefined | null | undefined,
): Promise<PiSettings> {
  const settingsManager = await getPiSettingsManager(projectPath)
  const updated =
    updateBooleanSetting(settingsManager, key, value) ||
    (await updateNonBooleanSetting(settingsManager, key, value, projectPath))

  if (updated) {
    await settingsManager.flush()
    await markRuntimeSettingsStaleForProject(null)
  }

  return loadPiSettingsInHost(projectPath)
}
