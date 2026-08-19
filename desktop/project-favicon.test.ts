import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProjectFavicon } from './project-favicon'

function tempProject() {
  const dir = mkdtempSync(path.join(tmpdir(), 'howcode-favicon-'))
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

describe('loadProjectFavicon', () => {
  it('ignores paths outside the project', async () => {
    const project = tempProject()
    try {
      writeFileSync(path.join(project.dir, 'index.html'), '<link rel="icon" href="/../escape.svg">')
      await expect(loadProjectFavicon(project.dir)).resolves.toBeNull()
    } finally {
      project.cleanup()
    }
  })
})
