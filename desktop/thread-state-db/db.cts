import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Utils } from "electrobun/bun";
import { ensureThreadStateSchema } from "./schema";

let database: Database | null = null;

function getDatabasePath() {
  const databaseDir = path.join(Utils.paths.userData, "state");
  mkdirSync(databaseDir, { recursive: true });
  return path.join(databaseDir, "desktop.sqlite");
}

export function getThreadStateDatabase() {
  if (database) {
    return database;
  }

  database = new Database(getDatabasePath());
  ensureThreadStateSchema(database);
  return database;
}
