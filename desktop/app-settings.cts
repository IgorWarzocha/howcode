import type { AppSettings, ModelSelection } from "../shared/desktop-contracts";
import { getThreadStateDatabase } from "./thread-state-db/db";

const gitCommitMessageModelKey = "gitCommitMessageModel";
const favoriteFoldersKey = "favoriteFolders";

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

function parseFavoriteFolders(valueJson: string | null | undefined): string[] {
  if (!valueJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function writeAppPreference(key: string, valueJson: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      INSERT INTO app_preferences (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(key, valueJson);
}

function deleteAppPreference(key: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM app_preferences
      WHERE key = ?
    `,
  ).run(key);
}

export function loadAppSettings(): AppSettings {
  const db = getThreadStateDatabase();
  const modelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitCommitMessageModelKey) as PreferenceRow | undefined;
  const favoriteFoldersRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(favoriteFoldersKey) as PreferenceRow | undefined;

  return {
    gitCommitMessageModel: parseModelSelection(modelRow?.valueJson),
    favoriteFolders: parseFavoriteFolders(favoriteFoldersRow?.valueJson),
  };
}

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(gitCommitMessageModelKey);
    return;
  }

  writeAppPreference(gitCommitMessageModelKey, JSON.stringify(selection));
}

export function setFavoriteFolders(favoriteFolders: string[]) {
  const normalizedFavoriteFolders = [
    ...new Set(favoriteFolders.map((folder) => folder.trim()).filter(Boolean)),
  ];

  if (normalizedFavoriteFolders.length === 0) {
    deleteAppPreference(favoriteFoldersKey);
    return;
  }

  writeAppPreference(favoriteFoldersKey, JSON.stringify(normalizedFavoriteFolders));
}
