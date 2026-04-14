import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getDesktopUserDataPath } from "../user-data-path.cts";
import { ensureThreadStateSchema } from "./schema.cts";

let database: Database | null = null;

function getDatabasePath() {
  const databaseDir = path.join(getDesktopUserDataPath(), "state");
  mkdirSync(databaseDir, { recursive: true });
  return path.join(databaseDir, "desktop.sqlite");
}

export function getThreadStateDatabase() {
  if (!database) {
    database = new Database(getDatabasePath());
  }

  ensureThreadStateSchema(database);
  return database;
}
