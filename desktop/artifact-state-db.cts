import type { Artifact, ArtifactKind, ArtifactVersion } from "../shared/desktop-contracts.ts";
import { emitDesktopEvent } from "./runtime/desktop-events.cts";
import { emitDesktopEvent as emitRuntimeHostDesktopEvent } from "./runtime-host/host-events.cts";
import { getThreadStateDatabase } from "./thread-state-db/db.cts";
import { runInTransaction } from "./thread-state-db/write-transaction.cts";

let artifactSchemaReady = false;

export function resetArtifactSchemaForTests() {
  artifactSchemaReady = false;
}

function ensureArtifactSchema() {
  if (artifactSchemaReady) return;
  const db = getThreadStateDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artifact_versions (
      artifact_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (artifact_id, version),
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS artifacts_conversation_idx ON artifacts(conversation_id, updated_at DESC);
  `);
  artifactSchemaReady = true;
}

type ArtifactRow = {
  slug: string;
  conversationId: string;
  kind: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ArtifactVersionRow = {
  slug: string;
  version: number;
  content: string;
  createdAt: string;
};

function mapArtifactRow(row: ArtifactRow): Artifact {
  return {
    slug: row.slug,
    conversationId: row.conversationId,
    kind: row.kind === "react" || row.kind === "markdown" ? row.kind : "html",
    content: row.content,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function slugifyArtifactSlug(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "artifact";
}

function createArtifactId(slug: string) {
  const db = getThreadStateDatabase();
  const base = slugifyArtifactSlug(slug);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const row = db.prepare("SELECT 1 FROM artifacts WHERE id = ?").get(candidate);
    if (!row) return candidate;
  }
  throw new Error(`Could not allocate artifact slug for ${base}.`);
}

function countOccurrences(content: string, text: string) {
  let count = 0;
  let index = content.indexOf(text);
  while (index !== -1) {
    count += 1;
    index = content.indexOf(text, index + text.length);
  }
  return count;
}

function applyArtifactEdits(
  content: string,
  edits: Array<{ oldText: string; newText: string }>,
  artifactId: string,
) {
  if (edits.length === 0) {
    throw new Error("Artifact edit input is invalid. edits must contain at least one replacement.");
  }
  const matches = edits.map((edit, index) => {
    if (edit.oldText.length === 0) {
      throw new Error(
        edits.length === 1
          ? `oldText must not be empty in ${artifactId}.`
          : `edits[${index}].oldText must not be empty in ${artifactId}.`,
      );
    }
    const matchIndex = content.indexOf(edit.oldText);
    if (matchIndex === -1) {
      throw new Error(
        edits.length === 1
          ? `Could not find the exact text in ${artifactId}. The old text must match exactly including all whitespace and newlines.`
          : `Could not find edits[${index}] in ${artifactId}. The oldText must match exactly including all whitespace and newlines.`,
      );
    }
    const occurrences = countOccurrences(content, edit.oldText);
    if (occurrences > 1) {
      throw new Error(
        edits.length === 1
          ? `Found ${occurrences} occurrences of the text in ${artifactId}. The text must be unique. Please provide more context to make it unique.`
          : `Found ${occurrences} occurrences of edits[${index}] in ${artifactId}. Each oldText must be unique. Please provide more context to make it unique.`,
      );
    }
    return { index, matchIndex, matchLength: edit.oldText.length, newText: edit.newText };
  });

  matches.sort((a, b) => a.matchIndex - b.matchIndex);
  for (let index = 1; index < matches.length; index += 1) {
    const previous = matches[index - 1];
    const current = matches[index];
    if (previous.matchIndex + previous.matchLength > current.matchIndex) {
      throw new Error(
        `edits[${previous.index}] and edits[${current.index}] overlap in ${artifactId}. Merge them into one edit or target disjoint regions.`,
      );
    }
  }

  let nextContent = content;
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    nextContent = `${nextContent.slice(0, match.matchIndex)}${match.newText}${nextContent.slice(
      match.matchIndex + match.matchLength,
    )}`;
  }
  if (nextContent === content) {
    throw new Error(
      edits.length === 1
        ? `No changes made to ${artifactId}. The replacement produced identical content.`
        : `No changes made to ${artifactId}. The replacements produced identical content.`,
    );
  }
  return nextContent;
}

function emitArtifactChange(artifact: Artifact) {
  const event = {
    type: "artifact-update" as const,
    conversationId: artifact.conversationId,
    artifact,
  };
  emitDesktopEvent(event);
  emitRuntimeHostDesktopEvent(event);
}

export function createArtifact(input: {
  conversationId: string;
  slug: string;
  kind: ArtifactKind;
  content: string;
}) {
  ensureArtifactSchema();
  const slug = slugifyArtifactSlug(input.slug);
  const content = input.content ?? "";
  const id = createArtifactId(slug);
  const db = getThreadStateDatabase();
  try {
    db.exec("BEGIN");
    db.prepare(
      `INSERT INTO artifacts (id, conversation_id, kind, content, version)
       VALUES (?, ?, ?, ?, 1)`,
    ).run(id, input.conversationId, input.kind, content);
    db.prepare(
      "INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, 1, ?)",
    ).run(id, content);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const artifact = getArtifact(id);
  if (!artifact) throw new Error("Artifact creation failed.");
  emitArtifactChange(artifact);
  return artifact;
}

export function deleteArtifactsForConversation(conversationId: string) {
  ensureArtifactSchema();
  getThreadStateDatabase()
    .prepare("DELETE FROM artifacts WHERE conversation_id = ?")
    .run(conversationId);
}

export function deleteArtifactsForConversations(conversationIds: string[]) {
  ensureArtifactSchema();
  if (conversationIds.length === 0) return;
  const db = getThreadStateDatabase();
  const deleteArtifacts = db.prepare("DELETE FROM artifacts WHERE conversation_id = ?");
  runInTransaction(db, () => {
    for (const conversationId of conversationIds) deleteArtifacts.run(conversationId);
  });
}

export function updateArtifact(input: {
  slug: string;
  content: string;
  conversationId?: string | null;
}) {
  ensureArtifactSchema();
  const current = getArtifact(input.slug, input.conversationId);
  if (!current) throw new Error(`Artifact not found: ${input.slug}`);
  const nextVersion = current.version + 1;
  const db = getThreadStateDatabase();
  try {
    db.exec("BEGIN");
    db.prepare(
      "UPDATE artifacts SET content = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(input.content, nextVersion, input.slug);
    db.prepare(
      "INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, ?, ?)",
    ).run(input.slug, nextVersion, input.content);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const artifact = getArtifact(input.slug, input.conversationId);
  if (!artifact) throw new Error("Artifact update failed.");
  emitArtifactChange(artifact);
  return artifact;
}

export function editArtifact(input: {
  slug: string;
  conversationId?: string | null;
  edits: Array<{ oldText: string; newText: string }>;
}) {
  const current = getArtifact(input.slug, input.conversationId);
  if (!current) throw new Error(`Artifact not found: ${input.slug}`);
  return updateArtifact({
    slug: input.slug,
    conversationId: input.conversationId,
    content: applyArtifactEdits(current.content, input.edits, input.slug),
  });
}

export function getArtifact(artifactId: string, conversationId?: string | null): Artifact | null {
  ensureArtifactSchema();
  const row = conversationId
    ? (getThreadStateDatabase()
        .prepare(
          `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM artifacts WHERE id = ? AND conversation_id = ?`,
        )
        .get(artifactId, conversationId) as ArtifactRow | undefined)
    : (getThreadStateDatabase()
        .prepare(
          `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM artifacts WHERE id = ?`,
        )
        .get(artifactId) as ArtifactRow | undefined);
  return row ? mapArtifactRow(row) : null;
}

export function listArtifacts(conversationId?: string | null): Artifact[] {
  ensureArtifactSchema();
  const rows = conversationId
    ? (getThreadStateDatabase()
        .prepare(
          `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM artifacts WHERE conversation_id = ? ORDER BY updated_at DESC`,
        )
        .all(conversationId) as ArtifactRow[])
    : (getThreadStateDatabase()
        .prepare(
          `SELECT id AS slug, conversation_id AS conversationId, kind, content, version,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM artifacts ORDER BY updated_at DESC`,
        )
        .all() as ArtifactRow[]);
  return rows.map(mapArtifactRow);
}

export function listArtifactVersions(artifactId: string): ArtifactVersion[] {
  ensureArtifactSchema();
  return getThreadStateDatabase()
    .prepare(
      `SELECT artifact_id AS slug, version, content, created_at AS createdAt
       FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC`,
    )
    .all(artifactId) as ArtifactVersionRow[];
}
