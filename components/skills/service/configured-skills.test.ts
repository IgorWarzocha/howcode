import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const roots = vi.hoisted(() => ({ directories: [] as string[] }))
vi.mock('./paths.ts', async (original) => ({
  ...(await original<typeof import('./paths.ts')>()),
  getGlobalSkillsDirs: () => roots.directories,
  getDirectorySkillsDirs: () => [],
  getChatSkillsDirs: () => [],
}))

import { listConfiguredPiSkills } from './configured-skills.ts'

afterEach(async () => {
  await Promise.all(
    roots.directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

it('discovers categorized and linked skills without following directory cycles', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-skills-'))
  roots.directories.push(directory)
  const skillDirectory = path.join(directory, 'code', 'inspect')
  await mkdir(skillDirectory, { recursive: true })
  await writeFile(
    path.join(skillDirectory, 'SKILL.md'),
    '---\nname: inspect\ndescription: Check a file\n---\nRead references.',
  )
  await symlink(directory, path.join(directory, 'cycle'))
  await symlink(skillDirectory, path.join(directory, 'linked'))
  const skills = await listConfiguredPiSkills()
  expect(skills.map((skill) => skill.displayName)).toContain('inspect')
  expect(skills.every((skill) => skill.scope === 'user')).toBe(true)
  expect(skills.length).toBeLessThanOrEqual(2)
})
