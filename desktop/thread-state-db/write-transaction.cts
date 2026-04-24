import type Database from "better-sqlite3";

export function runInTransaction(db: Database, operation: () => void) {
  db.exec("BEGIN");

  try {
    operation();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
