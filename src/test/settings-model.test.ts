import { describe, expect, it } from 'vitest'
import type { AppSettings } from '../app/desktop/types'
import { filterSettings, groupSettingsByCategory } from '../app/settings/settings/settingsGroups'
import {
  applyKeybindingMutation,
  formatSettingsAccelerator,
} from '../app/settings/settings/settingsKeybindings'
import type { SettingDescriptor } from '../app/settings/settings/settingsTypes'
import {
  normalizeCustomPiDirectoryDraft,
  normalizeOptionalSettingsPath,
} from '../app/settings/settings/useSettingsProjectController'

function setting(
  id: string,
  category: SettingDescriptor['category'],
  title: string,
  keywords = '',
): SettingDescriptor {
  return {
    id,
    category,
    title,
    description: `${title} description`,
    keywords,
    render: () => null,
  }
}

describe('settings domain model', () => {
  it('normalizes optional paths and expands a persisted Pi home prefix', () => {
    expect(normalizeOptionalSettingsPath('  /repo  ')).toBe('/repo')
    expect(normalizeOptionalSettingsPath('   ')).toBeNull()
    expect(normalizeCustomPiDirectoryDraft('~/.pi/agent', '/home/igorw/.pi/agent')).toBe(
      '/home/igorw/.pi/agent',
    )
    expect(normalizeCustomPiDirectoryDraft('~/other', '/home/igorw/.pi/agent')).toBe('~/other')
  })

  it('filters by active category until a search spans category labels and keywords', () => {
    const settings = [
      setting('theme', 'howcode', 'Theme'),
      setting('shortcut', 'shortcuts', 'Open command palette', 'hotkey keyboard'),
    ]

    expect(
      filterSettings({ settings, activeCategory: 'howcode', normalizedFilter: '' }).map(
        (item) => item.id,
      ),
    ).toEqual(['theme'])
    expect(
      filterSettings({ settings, activeCategory: 'howcode', normalizedFilter: 'hotkey' }).map(
        (item) => item.id,
      ),
    ).toEqual(['shortcut'])
    expect(
      filterSettings({ settings, activeCategory: null, normalizedFilter: 'shortcuts' }).map(
        (item) => item.id,
      ),
    ).toEqual(['shortcut'])
  })

  it('groups settings in category order and drops empty groups', () => {
    const groups = groupSettingsByCategory({
      settings: [
        setting('shortcut', 'shortcuts', 'Shortcut'),
        setting('theme', 'howcode', 'Theme'),
      ],
    })
    expect(groups.map((group) => [group.id, group.settings.map((item) => item.id)])).toEqual([
      ['howcode', ['theme']],
      ['shortcuts', ['shortcut']],
    ])
  })

  it('applies typed shortcut mutations without mutating the persisted source', () => {
    const keybindings: AppSettings['keybindings'] = { 'settings.open': 'Ctrl+,' }
    const disabled = applyKeybindingMutation(keybindings, 'settings.open', { kind: 'disable' })
    const reset = applyKeybindingMutation(disabled, 'settings.open', { kind: 'reset' })
    const updated = applyKeybindingMutation(reset, 'settings.open', {
      kind: 'set',
      accelerator: 'Ctrl+Shift+P',
    })
    const invalid = applyKeybindingMutation(updated, 'settings.open', {
      kind: 'set',
      accelerator: 'Ctrl',
    })

    expect(keybindings).toEqual({ 'settings.open': 'Ctrl+,' })
    expect(disabled['settings.open']).toBeNull()
    expect(reset).not.toHaveProperty('settings.open')
    expect(updated['settings.open']).toBe('Ctrl+Shift+P')
    expect(invalid).not.toHaveProperty('settings.open')
  })

  it('formats shortcuts for platform-native display', () => {
    expect(formatSettingsAccelerator('CmdOrCtrl+Shift+P', 'mac')).toBe('⌘⇧P')
    expect(formatSettingsAccelerator('CmdOrCtrl+Shift+P', 'linux')).toBe('Ctrl+Shift+P')
  })
})
