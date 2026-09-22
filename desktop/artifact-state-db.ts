import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { Artifact, ArtifactKind, ArtifactVersion } from '../shared/desktop-contracts.ts'
import { emitDesktopEvent } from './runtime/desktop-events.ts'
import { emitDesktopEvent as emitRuntimeHostDesktopEvent } from './runtime-host/host-events.ts'
import { databaseOperation } from './thread-state-db/db.ts'
import { decodePersistedRow, decodePersistedRows } from './thread-state-db/row-schema.ts'
import { withDatabaseTransaction } from './thread-state-db/write-transaction.ts'

const ArtifactRowSchema = Schema.Struct({
  slug: Schema.String,
  conversationId: Schema.String,
  kind: Schema.String,
  content: Schema.String,
  version: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const ArtifactVersionRowSchema = Schema.Struct({
  slug: Schema.String,
  version: Schema.Number,
  content: Schema.String,
  createdAt: Schema.String,
})

function mapArtifactRow(input: unknown): Artifact {
  const row = decodePersistedRow(ArtifactRowSchema, input, 'artifact')
  return {
    slug: row.slug,
    conversationId: row.conversationId,
    kind: row.kind === 'react' || row.kind === 'markdown' ? row.kind : 'html',
    content: row.content,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function slugifyArtifactSlug(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'artifact'
}

const createArtifactId = Effect.fn('ArtifactState.createId')(function* (slug: string) {
  const sql = yield* SqlClient.SqlClient
  const base = slugifyArtifactSlug(slug)
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`
    const rows = yield* sql.unsafe('SELECT 1 FROM artifacts WHERE id = ?', [candidate])
    if (!rows[0]) return candidate
  }
  throw new Error(`Could not allocate artifact slug for ${base}.`)
})

function countOccurrences(content: string, text: string) {
  let count = 0
  let index = content.indexOf(text)
  while (index !== -1) {
    count += 1
    index = content.indexOf(text, index + text.length)
  }
  return count
}

function applyArtifactEdits(
  content: string,
  edits: Array<{ oldText: string; newText: string }>,
  artifactId: string,
) {
  if (edits.length === 0) {
    throw new Error('Artifact edit input is invalid. edits must contain at least one replacement.')
  }
  const matches = edits.map((edit, index) => {
    if (edit.oldText.length === 0) {
      throw new Error(
        edits.length === 1
          ? `oldText must not be empty in ${artifactId}.`
          : `edits[${index}].oldText must not be empty in ${artifactId}.`,
      )
    }
    const matchIndex = content.indexOf(edit.oldText)
    if (matchIndex === -1) {
      throw new Error(
        edits.length === 1
          ? `Could not find the exact text in ${artifactId}. The old text must match exactly including all whitespace and newlines.`
          : `Could not find edits[${index}] in ${artifactId}. The oldText must match exactly including all whitespace and newlines.`,
      )
    }
    const occurrences = countOccurrences(content, edit.oldText)
    if (occurrences > 1) {
      throw new Error(
        edits.length === 1
          ? `Found ${occurrences} occurrences of the text in ${artifactId}. The text must be unique. Please provide more context to make it unique.`
          : `Found ${occurrences} occurrences of edits[${index}] in ${artifactId}. Each oldText must be unique. Please provide more context to make it unique.`,
      )
    }
    return { index, matchIndex, matchLength: edit.oldText.length, newText: edit.newText }
  })

  matches.sort((a, b) => a.matchIndex - b.matchIndex)
  for (let index = 1; index < matches.length; index += 1) {
    const previous = matches[index - 1]
    const current = matches[index]
    if (!(previous && current)) continue
    if (previous.matchIndex + previous.matchLength > current.matchIndex) {
      throw new Error(
        `edits[${previous.index}] and edits[${current.index}] overlap in ${artifactId}. Merge them into one edit or target disjoint regions.`,
      )
    }
  }

  let nextContent = content
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    if (!match) continue
    nextContent = `${nextContent.slice(0, match.matchIndex)}${match.newText}${nextContent.slice(
      match.matchIndex + match.matchLength,
    )}`
  }
  if (nextContent === content) {
    throw new Error(
      edits.length === 1
        ? `No changes made to ${artifactId}. The replacement produced identical content.`
        : `No changes made to ${artifactId}. The replacements produced identical content.`,
    )
  }
  return nextContent
}

function emitArtifactChange(artifact: Artifact) {
  const event = {
    type: 'artifact-update' as const,
    conversationId: artifact.conversationId,
    artifact,
  }
  emitDesktopEvent(event)
  emitRuntimeHostDesktopEvent(event)
}

type CreateArtifactInput = {
  conversationId: string
  slug: string
  kind: ArtifactKind
  content: string
}

const createArtifactOperation = Effect.fn('ArtifactState.create')(function* (
  input: CreateArtifactInput,
) {
  const slug = slugifyArtifactSlug(input.slug)
  const content = input.content ?? ''
  const id = yield* createArtifactId(slug)
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      yield* sql.unsafe(
        `INSERT INTO artifacts (id, conversation_id, kind, content, version)
         VALUES (?, ?, ?, ?, 1)`,
        [id, input.conversationId, input.kind, content],
      )
      yield* sql.unsafe(
        'INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, 1, ?)',
        [id, content],
      )
    }),
  )
  const artifact = yield* getArtifactOperation(id)
  if (!artifact) throw new Error('Artifact creation failed.')
  emitArtifactChange(artifact)
  return artifact
})

export const createArtifact = databaseOperation(createArtifactOperation)

const deleteArtifactsForConversationOperation = Effect.fn('ArtifactState.deleteForConversation')(
  function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    yield* sql.unsafe('DELETE FROM artifacts WHERE conversation_id = ?', [conversationId])
  },
)

export const deleteArtifactsForConversation = databaseOperation(
  deleteArtifactsForConversationOperation,
)

const deleteArtifactsForConversationsOperation = Effect.fn('ArtifactState.deleteForConversations')(
  function* (conversationIds: string[]) {
    if (conversationIds.length === 0) return
    const sql = yield* SqlClient.SqlClient
    yield* withDatabaseTransaction(
      Effect.gen(function* () {
        for (const conversationId of conversationIds) {
          yield* sql.unsafe('DELETE FROM artifacts WHERE conversation_id = ?', [conversationId])
        }
      }),
    )
  },
)

export const deleteArtifactsForConversations = databaseOperation(
  deleteArtifactsForConversationsOperation,
)

type UpdateArtifactInput = {
  slug: string
  content: string
  conversationId?: string | undefined | null | undefined
}

const updateArtifactOperation = Effect.fn('ArtifactState.update')(function* (
  input: UpdateArtifactInput,
) {
  const current = yield* getArtifactOperation(input.slug, input.conversationId)
  if (!current) throw new Error(`Artifact not found: ${input.slug}`)
  const nextVersion = current.version + 1
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      yield* sql.unsafe(
        'UPDATE artifacts SET content = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [input.content, nextVersion, input.slug],
      )
      yield* sql.unsafe(
        'INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, ?, ?)',
        [input.slug, nextVersion, input.content],
      )
    }),
  )
  const artifact = yield* getArtifactOperation(input.slug, input.conversationId)
  if (!artifact) throw new Error('Artifact update failed.')
  emitArtifactChange(artifact)
  return artifact
})

export const updateArtifact = databaseOperation(updateArtifactOperation)

type EditArtifactInput = {
  slug: string
  conversationId?: string | undefined | null | undefined
  edits: Array<{ oldText: string; newText: string }>
}

const editArtifactOperation = Effect.fn('ArtifactState.edit')(function* (input: EditArtifactInput) {
  const current = yield* getArtifactOperation(input.slug, input.conversationId)
  if (!current) throw new Error(`Artifact not found: ${input.slug}`)
  return yield* updateArtifactOperation({
    slug: input.slug,
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
    content: applyArtifactEdits(current.content, input.edits, input.slug),
  })
})

export const editArtifact = databaseOperation(editArtifactOperation)

const getArtifactOperation = Effect.fn('ArtifactState.get')(function* (
  artifactId: string,
  conversationId?: string | undefined | null | undefined,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = conversationId
    ? yield* sql.unsafe(
        `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                created_at AS createdAt, updated_at AS updatedAt
         FROM artifacts WHERE id = ? AND conversation_id = ?`,
        [artifactId, conversationId],
      )
    : yield* sql.unsafe(
        `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                created_at AS createdAt, updated_at AS updatedAt
         FROM artifacts WHERE id = ?`,
        [artifactId],
      )
  const row = rows[0]
  return row ? mapArtifactRow(row) : null
})

export const getArtifact: (artifactId: string, conversationId?: string | null) => Artifact | null =
  databaseOperation(getArtifactOperation)

const listArtifactsOperation = Effect.fn('ArtifactState.list')(function* (
  conversationId?: string | undefined | null | undefined,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = conversationId
    ? yield* sql.unsafe(
        `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                created_at AS createdAt, updated_at AS updatedAt
         FROM artifacts WHERE conversation_id = ? ORDER BY updated_at DESC`,
        [conversationId],
      )
    : yield* sql.unsafe(
        `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                created_at AS createdAt, updated_at AS updatedAt
         FROM artifacts ORDER BY updated_at DESC`,
      )
  return rows.map(mapArtifactRow)
})

export const listArtifacts: (conversationId?: string | null) => Artifact[] =
  databaseOperation(listArtifactsOperation)

const listArtifactVersionsOperation = Effect.fn('ArtifactState.listVersions')(function* (
  artifactId: string,
) {
  const sql = yield* SqlClient.SqlClient
  return decodePersistedRows(
    ArtifactVersionRowSchema,
    yield* sql.unsafe(
      `SELECT artifact_id AS slug, version, content, created_at AS createdAt
       FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC`,
      [artifactId],
    ),
    'artifact version',
  )
})

export const listArtifactVersions: (artifactId: string) => ArtifactVersion[] = databaseOperation(
  listArtifactVersionsOperation,
)
