import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { app } from "electron";
import { ensureThreadStateSchema } from "./schema.cjs";

let database: DatabaseSync | null = null;

function getDatabasePath() {
  const databaseDir = path.join(app.getPath("userData"), "state");
  mkdirSync(databaseDir, { recursive: true });
  return path.join(databaseDir, "desktop.sqlite");
}

export function getThreadStateDatabase() {
  if (database) {
    return database;
  }

  database = new DatabaseSync(getDatabasePath());
  ensureThreadStateSchema(database);
  return database;
}
