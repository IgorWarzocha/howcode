import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  it('serves a well-known root favicon first', async () => {
    const project = tempProject()
    try {
      writeFileSync(path.join(project.dir, 'favicon.svg'), '<svg>root</svg>')
      await expect(loadProjectFavicon(project.dir)).resolves.toBe(
        `data:image/svg+xml;base64,${Buffer.from('<svg>root</svg>').toString('base64')}`,
      )
    } finally {
      project.cleanup()
    }
  })

  it('resolves icon links from app metadata files', async () => {
    const project = tempProject()
    try {
      const iconPath = path.join(project.dir, 'public', 'brand', 'logo.svg')
      mkdirSync(path.dirname(iconPath), { recursive: true })
      mkdirSync(path.join(project.dir, 'src', 'app'), { recursive: true })
      writeFileSync(
        path.join(project.dir, 'src', 'app', 'layout.tsx'),
        '<link href="/brand/logo.svg" rel="apple-touch-icon">',
      )
      writeFileSync(iconPath, '<svg>brand</svg>')
      await expect(loadProjectFavicon(project.dir)).resolves.toBe(
        `data:image/svg+xml;base64,${Buffer.from('<svg>brand</svg>').toString('base64')}`,
      )
    } finally {
      project.cleanup()
    }
  })

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
