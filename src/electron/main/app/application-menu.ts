import { type BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { getDesktopEventIpcChannel } from '../../../../shared/desktop-ipc'
import {
  getEffectiveAccelerators,
  isValidAccelerator,
  type KeybindingCommandId,
} from '../../../../shared/keybindings'
import type { PiThreadsService } from '../runtime/desktop-runtime-contracts'

function getPrimaryAccelerator(
  commandId: KeybindingCommandId,
  keybindings: Awaited<ReturnType<PiThreadsService['loadAppSettings']>>['keybindings'],
) {
  return getEffectiveAccelerators(keybindings)
    .get(commandId)
    ?.find((accelerator) => !accelerator.includes(' ') && isValidAccelerator(accelerator))
}

function sendKeybindingCommand(mainWindow: BrowserWindow | null, commandId: KeybindingCommandId) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(getDesktopEventIpcChannel('desktopEvent'), {
    type: 'keybinding-command',
    commandId,
  })
}

function keybindingMenuItem(input: {
  label: string
  commandId: KeybindingCommandId
  accelerator?: string | undefined
  getMainWindow: () => BrowserWindow | null
}): MenuItemConstructorOptions {
  return {
    label: input.label,
    ...(input.accelerator ? { accelerator: input.accelerator } : {}),
    registerAccelerator: false,
    click: () => sendKeybindingCommand(input.getMainWindow(), input.commandId),
  }
}

function toggleDevTools(mainWindow: BrowserWindow | null) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.toggleDevTools()
}

export async function installApplicationMenu(input: {
  getMainWindow: () => BrowserWindow | null
  piThreads: PiThreadsService
}) {
  const appSettings = await input.piThreads.loadAppSettings()
  const accelerator = (commandId: KeybindingCommandId) =>
    getPrimaryAccelerator(commandId, appSettings.keybindings)

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Howcode',
        submenu: [
          keybindingMenuItem({
            label: 'Settings',
            commandId: 'settings.open',
            accelerator: accelerator('settings.open'),
            getMainWindow: input.getMainWindow,
          }),
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [
          keybindingMenuItem({
            label: 'New Thread',
            commandId: 'thread.new',
            accelerator: accelerator('thread.new'),
            getMainWindow: input.getMainWindow,
          }),
        ],
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Developer Tools',
            accelerator: 'F12',
            click: () => toggleDevTools(input.getMainWindow()),
          },
          {
            label: 'Toggle Developer Tools (Chrome)',
            accelerator: 'CommandOrControl+Shift+I',
            visible: false,
            click: () => toggleDevTools(input.getMainWindow()),
          },
          { type: 'separator' },
          keybindingMenuItem({
            label: 'Toggle Sidebar',
            commandId: 'sidebar.toggle',
            accelerator: accelerator('sidebar.toggle'),
            getMainWindow: input.getMainWindow,
          }),
          keybindingMenuItem({
            label: 'Toggle Terminal',
            commandId: 'terminal.toggle',
            accelerator: accelerator('terminal.toggle'),
            getMainWindow: input.getMainWindow,
          }),
          keybindingMenuItem({
            label: 'Open GitOps',
            commandId: 'gitops.open',
            accelerator: accelerator('gitops.open'),
            getMainWindow: input.getMainWindow,
          }),
          keybindingMenuItem({
            label: 'Toggle Changed Files',
            commandId: 'gitops.toggleChangedFiles',
            accelerator: accelerator('gitops.toggleChangedFiles'),
            getMainWindow: input.getMainWindow,
          }),
        ],
      },
      {
        label: 'Navigate',
        submenu: [
          keybindingMenuItem({
            label: 'Previous Thread in Project',
            commandId: 'thread.previousInProject',
            accelerator: accelerator('thread.previousInProject'),
            getMainWindow: input.getMainWindow,
          }),
          keybindingMenuItem({
            label: 'Next Thread in Project',
            commandId: 'thread.nextInProject',
            accelerator: accelerator('thread.nextInProject'),
            getMainWindow: input.getMainWindow,
          }),
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
        ],
      },
    ]),
  )
}
