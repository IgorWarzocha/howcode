import { randomUUID } from "node:crypto";
import type { Artifact, ArtifactKind, ArtifactVersion } from "../shared/desktop-contracts.ts";
import { emitDesktopEvent } from "./runtime/desktop-events.cts";
import { emitDesktopEvent as emitRuntimeHostDesktopEvent } from "./runtime-host/host-events.cts";
import { getThreadStateDatabase } from "./thread-state-db/db.cts";

let artifactSchemaReady = false;

function ensureArtifactSchema() {
  if (artifactSchemaReady) return;
  const db = getThreadStateDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      title TEXT NOT NULL,
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
  id: string;
  conversationId: string;
  title: string;
  kind: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ArtifactVersionRow = {
  artifactId: string;
  version: number;
  content: string;
  createdAt: string;
};

function mapArtifactRow(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    conversationId: row.conversationId,
    title: row.title,
    kind: row.kind === "react" ? "react" : "html",
    content: row.content,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
  title: string;
  kind: ArtifactKind;
  content: string;
}) {
  ensureArtifactSchema();
  const title = input.title.trim() || "Untitled artifact";
  const content = input.content ?? "";
  const id = randomUUID();
  const db = getThreadStateDatabase();
  try {
    db.exec("BEGIN");
    db.prepare(
      `INSERT INTO artifacts (id, conversation_id, title, kind, content, version)
       VALUES (?, ?, ?, ?, ?, 1)`,
    ).run(id, input.conversationId, title, input.kind, content);
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

export function updateArtifact(input: { artifactId: string; content: string }) {
  ensureArtifactSchema();
  const current = getArtifact(input.artifactId);
  if (!current) throw new Error(`Artifact not found: ${input.artifactId}`);
  const nextVersion = current.version + 1;
  const db = getThreadStateDatabase();
  try {
    db.exec("BEGIN");
    db.prepare(
      "UPDATE artifacts SET content = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(input.content, nextVersion, input.artifactId);
    db.prepare(
      "INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, ?, ?)",
    ).run(input.artifactId, nextVersion, input.content);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const artifact = getArtifact(input.artifactId);
  if (!artifact) throw new Error("Artifact update failed.");
  emitArtifactChange(artifact);
  return artifact;
}

export function getArtifact(artifactId: string): Artifact | null {
  ensureArtifactSchema();
  const row = getThreadStateDatabase()
    .prepare(
      `SELECT id, conversation_id AS conversationId, title, kind, content, version,
              created_at AS createdAt, updated_at AS updatedAt
       FROM artifacts WHERE id = ?`,
    )
    .get(artifactId) as ArtifactRow | undefined;
  return row ? mapArtifactRow(row) : null;
}

export function listArtifacts(conversationId?: string | null): Artifact[] {
  ensureArtifactSchema();
  const rows = conversationId
    ? (getThreadStateDatabase()
        .prepare(
          `SELECT id, conversation_id AS conversationId, title, kind, content, version,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM artifacts WHERE conversation_id = ? ORDER BY updated_at DESC`,
        )
        .all(conversationId) as ArtifactRow[])
    : (getThreadStateDatabase()
        .prepare(
          `SELECT id, conversation_id AS conversationId, title, kind, content, version,
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
      `SELECT artifact_id AS artifactId, version, content, created_at AS createdAt
       FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC`,
    )
    .all(artifactId) as ArtifactVersionRow[];
}
