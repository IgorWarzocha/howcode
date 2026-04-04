import type { AppSettings, ModelSelection } from "../shared/desktop-contracts";
import { getThreadStateDatabase } from "./thread-state-db/db";

const gitCommitMessageModelKey = "gitCommitMessageModel";

type PreferenceRow = {
  valueJson: string;
};

function parseModelSelection(valueJson: string | null | undefined): ModelSelection | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as { id?: unknown; provider?: unknown };
    return typeof parsed.provider === "string" && typeof parsed.id === "string"
      ? { provider: parsed.provider, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

export function loadAppSettings(): AppSettings {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitCommitMessageModelKey) as PreferenceRow | undefined;

  return {
    gitCommitMessageModel: parseModelSelection(row?.valueJson),
  };
}

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  const db = getThreadStateDatabase();

  if (!selection) {
    db.prepare(
      `
        DELETE FROM app_preferences
        WHERE key = ?
      `,
    ).run(gitCommitMessageModelKey);
    return;
  }

  db.prepare(
    `
      INSERT INTO app_preferences (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(gitCommitMessageModelKey, JSON.stringify(selection));
}
