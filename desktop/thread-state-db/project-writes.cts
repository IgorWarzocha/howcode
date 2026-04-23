import path from "node:path";
import { getThreadStateDatabase } from "./db.cts";
import { runInTransaction } from "./write-transaction.cts";

export function ensureProject(cwd: string) {
  const db = getThreadStateDatabase();
  const projectName = path.basename(cwd) || cwd;

  db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        hidden = 0,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(cwd, projectName);
}

export function setProjectCollapsed(projectId: string, collapsed: boolean) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(collapsed ? 1 : 0, projectId);
}

export function toggleProjectPinned(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectId);
}

export function collapseAllProjects() {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = 1, updated_at = CURRENT_TIMESTAMP
    `,
  ).run();
}

export function archiveProjectThreads(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ? AND archived = 0
    `,
  ).run(projectId);
}

export function renameProject(projectId: string, projectName: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET custom_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectName, projectId);
}

export function setProjectRepoOrigin(projectId: string, originUrl: string | null) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET repo_origin_url = ?, repo_origin_checked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(originUrl, projectId);
}

export function reorderProjects(projectIds: string[]) {
  if (projectIds.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const updateProjectOrder = db.prepare(
    `
      UPDATE projects
      SET order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  );

  runInTransaction(db, () => {
    projectIds.forEach((projectId, index) => {
      updateProjectOrder.run(index, projectId);
    });
  });
}

export function moveProjectToTop(projectId: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT MIN(order_index) AS minOrderIndex
        FROM projects
        WHERE hidden = 0 AND order_index IS NOT NULL
      `,
    )
    .get() as { minOrderIndex?: number | null } | undefined;

  const nextOrderIndex = typeof row?.minOrderIndex === "number" ? row.minOrderIndex - 1 : 0;

  db.prepare(
    `
      UPDATE projects
      SET order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(nextOrderIndex, projectId);
}

export function hideProject(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET hidden = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectId);
}

export function deleteProject(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM projects
      WHERE cwd = ?
    `,
  ).run(projectId);
}
