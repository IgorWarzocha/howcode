import { describe, expect, it } from 'vitest'
import { getWslTerminalLaunch, resolveTerminalCommand } from './terminal-command.helpers.ts'

const windowsEnv = {
  PATH: 'C:\\Windows\\System32',
  USERPROFILE: 'C:\\Users\\Tester',
}

describe('terminal command helpers', () => {
  it('maps WSL UNC project paths to a WSL terminal launch on Windows', () => {
    const launch = getWslTerminalLaunch('\\\\wsl.localhost\\Ubuntu-24.04\\home\\me\\project', {
      platform: 'win32',
      env: windowsEnv,
    })

    expect(launch).toEqual({
      distro: 'Ubuntu-24.04',
      linuxPath: '/home/me/project',
      windowsSpawnCwd: 'C:\\Users\\Tester',
    })
  })

  it('supports the legacy wsl$ UNC prefix', () => {
    const command = resolveTerminalCommand(
      {
        projectId: '\\\\wsl$\\Ubuntu\\home\\me\\repo',
        cwd: '\\\\wsl$\\Ubuntu\\home\\me\\repo',
        launchMode: 'shell',
        cols: 80,
        rows: 24,
      },
      { platform: 'win32', env: windowsEnv },
    )

    expect(command.shell.endsWith('wsl.exe')).toBe(true)
    expect(command).toMatchObject({
      args: ['-d', 'Ubuntu', '--cd', '/home/me/repo'],
      cwd: 'C:\\Users\\Tester',
    })
  })

  it('keeps native Windows projects on the normal Windows shell', () => {
    const command = resolveTerminalCommand(
      {
        projectId: 'C:\\Projects\\app',
        cwd: 'C:\\Projects\\app',
        launchMode: 'shell',
        cols: 80,
        rows: 24,
      },
      { platform: 'win32', env: { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' } },
    )

    expect(command).toEqual({
      shell: 'C:\\Windows\\System32\\cmd.exe',
      args: [],
      cwd: undefined,
    })
  })
})
