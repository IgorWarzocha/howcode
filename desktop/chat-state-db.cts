import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ChatSidebarState, ChatThread } from "../shared/desktop-contracts.ts";
import { getChatSessionDir } from "./chat-session-dir.cts";
import { getThreadStateDatabase } from "./thread-state-db/db.cts";
import { mapThreadRow } from "./thread-state-db/mappers.cts";
import type { ThreadRow } from "./thread-state-db/types.cts";

type ChatGroupRow = {
  id: string;
  name: string;
  orderIndex: number | null;
  collapsed: number;
};

type ChatThreadGroupRow = ThreadRow & { groupId: string | null; projectId: string };

let chatSchemaReady = false;

function ensureChatStateSchema() {
  if (chatSchemaReady) return;
  const db = getThreadStateDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      order_index INTEGER,
      collapsed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      session_path TEXT PRIMARY KEY,
      group_id TEXT,
      order_index INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS chat_groups_order_idx ON chat_groups(order_index, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS chat_threads_group_idx ON chat_threads(group_id, order_index);
  `);
  chatSchemaReady = true;
}

export function isChatSessionPath(sessionPath: string) {
  const chatSessionDir = getChatSessionDir();
  const relativePath = path.relative(chatSessionDir, sessionPath);
  return (
    relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
  );
}

export function createChatGroup(name: string): ChatSidebarState {
  ensureChatStateSchema();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Enter a group name.");
  const db = getThreadStateDatabase();
  const id = randomUUID();
  const nextOrder = (
    db.prepare("SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM chat_groups").get() as {
      nextOrder: number;
    }
  ).nextOrder;
  db.prepare("INSERT INTO chat_groups (id, name, order_index) VALUES (?, ?, ?)").run(
    id,
    trimmedName,
    nextOrder,
  );
  return getChatSidebarState(id);
}

export function upsertChatThread(options: {
  sessionPath: string;
  groupId?: string | null;
}) {
  if (!isChatSessionPath(options.sessionPath)) return;
  ensureChatStateSchema();
  getThreadStateDatabase()
    .prepare(
      `
        INSERT INTO chat_threads (session_path, group_id)
        VALUES (?, ?)
        ON CONFLICT(session_path) DO UPDATE SET
          group_id = COALESCE(chat_threads.group_id, excluded.group_id),
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(options.sessionPath, options.groupId ?? null);
}

function mapChatThreadRow(row: ChatThreadGroupRow): ChatThread {
  return { ...mapThreadRow(row), groupId: row.groupId, projectId: row.projectId };
}

export function getChatSidebarState(selectedGroupId: string | null = null): ChatSidebarState {
  ensureChatStateSchema();
  const db = getThreadStateDatabase();
  const groups: ChatSidebarState["groups"] = (
    db
      .prepare(
        `
        SELECT id, name, order_index AS orderIndex, collapsed
        FROM chat_groups
        ORDER BY order_index ASC, name COLLATE NOCASE ASC
      `,
      )
      .all() as ChatGroupRow[]
  ).map((group) => ({
    id: group.id,
    name: group.name,
    orderIndex: group.orderIndex,
    collapsed: Boolean(group.collapsed),
    threads: [],
  }));

  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS id,
          threads.cwd AS projectId,
          threads.title AS title,
          threads.session_path AS sessionPath,
          COALESCE(inbox_items.last_assistant_preview, threads.last_assistant_preview) AS summary,
          threads.running AS running,
          COALESCE(inbox_items.unread, 0) AS unread,
          threads.pinned AS pinned,
          threads.last_modified_ms AS lastModifiedMs,
          chat_threads.group_id AS groupId
        FROM chat_threads
        INNER JOIN threads ON threads.session_path = chat_threads.session_path
        LEFT JOIN inbox_items ON inbox_items.session_path = threads.session_path
        WHERE threads.archived = 0
        ORDER BY threads.pinned DESC, COALESCE(chat_threads.order_index, threads.last_modified_ms) DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all() as ChatThreadGroupRow[];

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const ungroupedThreads: ChatThread[] = [];
  for (const row of rows) {
    const thread = mapChatThreadRow(row);
    const group = thread.groupId ? groupsById.get(thread.groupId) : null;
    if (group) group.threads.push(thread);
    else ungroupedThreads.push(thread);
  }

  return { groups, ungroupedThreads, selectedGroupId };
}
