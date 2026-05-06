import { beforeEach, describe, expect, it, vi } from 'vitest'

const ambiguousEditErrorPattern = /Found 2 occurrences/

type ArtifactRow = {
  id: string
  conversationId: string
  kind: string
  content: string
  version: number
  createdAt: string
  updatedAt: string
}

type ArtifactVersionRow = {
  artifactId: string
  version: number
  content: string
  createdAt: string
}

const fakeState = {
  artifacts: new Map<string, ArtifactRow>(),
  versions: [] as ArtifactVersionRow[],
}

function resetFakeState() {
  fakeState.artifacts.clear()
  fakeState.versions = []
}

function mapArtifact(row: ArtifactRow) {
  return {
    slug: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    content: row.content,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapVersion(row: ArtifactVersionRow) {
  return {
    slug: row.artifactId,
    version: row.version,
    content: row.content,
    createdAt: row.createdAt,
  }
}

function getFakeStatementRow(normalized: string, params: unknown[]) {
  if (normalized.startsWith('PRAGMA table_info')) return undefined
  if (normalized.includes('FROM sqlite_master')) return undefined
  if (normalized === 'SELECT 1 FROM artifacts WHERE id = ?') {
    return fakeState.artifacts.has(String(params[0])) ? { 1: 1 } : undefined
  }
  if (normalized.includes('FROM artifacts WHERE id = ? AND conversation_id = ?')) {
    const row = fakeState.artifacts.get(String(params[0]))
    return row && row.conversationId === params[1] ? mapArtifact(row) : undefined
  }
  if (normalized.includes('FROM artifacts WHERE id = ?')) {
    const row = fakeState.artifacts.get(String(params[0]))
    return row ? mapArtifact(row) : undefined
  }
  return undefined
}

function insertFakeArtifact(params: unknown[]) {
  const [id, conversationId, kind, content] = params.map(String)
  if (!(id && conversationId && kind && content)) {
    throw new Error('Missing artifact insert params')
  }
  fakeState.artifacts.set(id, {
    id,
    conversationId,
    kind,
    content,
    version: 1,
    createdAt: 'created',
    updatedAt: 'updated',
  })
}

function insertFakeArtifactVersion(params: unknown[]) {
  const [artifactId, versionOrContent, maybeContent] = params
  const version = typeof maybeContent === 'undefined' ? 1 : Number(versionOrContent)
  const content = String(typeof maybeContent === 'undefined' ? versionOrContent : maybeContent)
  fakeState.versions.push({
    artifactId: String(artifactId),
    version,
    content,
    createdAt: `version-${version}`,
  })
}

function updateFakeArtifact(params: unknown[]) {
  const [content, version, id] = params
  const row = fakeState.artifacts.get(String(id))
  if (!row) return
  row.content = String(content)
  row.version = Number(version)
  row.updatedAt = `updated-${version}`
}

function deleteFakeArtifactsForConversation(conversationId: unknown) {
  for (const [id, row] of fakeState.artifacts) {
    if (row.conversationId === conversationId) fakeState.artifacts.delete(id)
  }
}

function createStatement(sql: string) {
  const normalized = sql.replace(/\s+/g, ' ').trim()
  return {
    get: (...params: unknown[]) => getFakeStatementRow(normalized, params),
    all: (...params: unknown[]) => {
      if (normalized.startsWith('PRAGMA table_info')) return []
      if (normalized.includes('SELECT cwd FROM projects')) return []
      if (normalized.includes('FROM artifact_versions WHERE artifact_id = ?')) {
        return fakeState.versions
          .filter((row) => row.artifactId === params[0])
          .sort((a, b) => b.version - a.version)
          .map(mapVersion)
      }
      if (normalized.includes('FROM artifacts WHERE conversation_id = ?')) {
        return [...fakeState.artifacts.values()]
          .filter((row) => row.conversationId === params[0])
          .map(mapArtifact)
      }
      if (normalized.includes('FROM artifacts ORDER BY')) {
        return [...fakeState.artifacts.values()].map(mapArtifact)
      }
      return []
    },
    run: (...params: unknown[]) => {
      if (normalized.startsWith('INSERT INTO artifacts')) {
        insertFakeArtifact(params)
      }
      if (normalized.startsWith('INSERT INTO artifact_versions')) {
        insertFakeArtifactVersion(params)
      }
      if (normalized.startsWith('UPDATE artifacts SET content = ?')) {
        updateFakeArtifact(params)
      }
      if (normalized.startsWith('DELETE FROM artifacts WHERE conversation_id = ?')) {
        deleteFakeArtifactsForConversation(params[0])
      }
      return { changes: 1 }
    },
  }
}

vi.mock('better-sqlite3', () => ({
  default: class FakeDatabase {
    exec() {
      // Test double intentionally does not execute schema SQL.
    }
    close() {
      // Test double has no native resources to release.
    }
    prepare(sql: string) {
      return createStatement(sql)
    }
  },
}))

async function loadArtifactDb() {
  const [artifactDb, threadDb] = await Promise.all([
    import('./artifact-state-db.ts'),
    import('./thread-state-db/db.ts'),
  ])
  return { artifactDb, threadDb }
}

describe('artifact state db', () => {
  beforeEach(async () => {
    resetFakeState()
    const { artifactDb, threadDb } = await loadArtifactDb()
    threadDb.closeThreadStateDatabaseForTests()
    artifactDb.resetArtifactSchemaForTests()
  })

  it('creates, versions, updates, and lists artifacts by conversation', async () => {
    const { artifactDb } = await loadArtifactDb()

    const first = artifactDb.createArtifact({
      conversationId: 'conversation-a',
      slug: 'Demo Artifact',
      kind: 'markdown',
      content: 'hello',
    })
    const second = artifactDb.createArtifact({
      conversationId: 'conversation-b',
      slug: 'Demo Artifact',
      kind: 'html',
      content: '<p>other</p>',
    })
    const updated = artifactDb.updateArtifact({
      slug: first.slug,
      conversationId: 'conversation-a',
      content: 'hello again',
    })

    expect(first.slug).toBe('demo-artifact')
    expect(second.slug).toBe('demo-artifact-2')
    expect(updated.version).toBe(2)
    expect(artifactDb.getArtifact(first.slug, 'conversation-a')?.content).toBe('hello again')
    expect(artifactDb.getArtifact(first.slug, 'conversation-b')).toBeNull()
    expect(artifactDb.listArtifacts('conversation-a').map((artifact) => artifact.slug)).toEqual([
      first.slug,
    ])
    expect(
      artifactDb.listArtifactVersions(first.slug).map((version) => ({
        version: version.version,
        content: version.content,
      })),
    ).toEqual([
      { version: 2, content: 'hello again' },
      { version: 1, content: 'hello' },
    ])
  })

  it('applies exact non-overlapping edits as a new version', async () => {
    const { artifactDb } = await loadArtifactDb()
    const artifact = artifactDb.createArtifact({
      conversationId: 'conversation-a',
      slug: 'page',
      kind: 'html',
      content: '<h1>Old</h1><p>Body</p>',
    })

    const edited = artifactDb.editArtifact({
      slug: artifact.slug,
      conversationId: 'conversation-a',
      edits: [
        { oldText: 'Old', newText: 'New' },
        { oldText: 'Body', newText: 'Copy' },
      ],
    })

    expect(edited.content).toBe('<h1>New</h1><p>Copy</p>')
    expect(edited.version).toBe(2)
  })

  it('rejects ambiguous edits without mutating content', async () => {
    const { artifactDb } = await loadArtifactDb()
    const artifact = artifactDb.createArtifact({
      conversationId: 'conversation-a',
      slug: 'copy',
      kind: 'markdown',
      content: 'repeat repeat',
    })

    expect(() =>
      artifactDb.editArtifact({
        slug: artifact.slug,
        conversationId: 'conversation-a',
        edits: [{ oldText: 'repeat', newText: 'done' }],
      }),
    ).toThrow(ambiguousEditErrorPattern)
    expect(artifactDb.getArtifact(artifact.slug, 'conversation-a')?.content).toBe('repeat repeat')
    expect(artifactDb.listArtifactVersions(artifact.slug)).toHaveLength(1)
  })
})
