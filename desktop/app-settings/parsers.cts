import type {
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  GitOpsMode,
  ModelSelection,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
  ProjectDeletionMode,
} from "../../shared/desktop-contracts.ts";

export type PreferenceRow = {
  valueJson: string;
};

export function parseModelSelection(valueJson: string | null | undefined): ModelSelection | null {
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

export function parseFavoriteFolders(valueJson: string | null | undefined): string[] {
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

export function parseBooleanPreference(valueJson: string | null | undefined): boolean | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseStringPreference(valueJson: string | null | undefined): string | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "string" && parsed.trim().length > 0 ? parsed.trim() : null;
  } catch {
    return null;
  }
}

export function parseNumberPreference(valueJson: string | null | undefined): number | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseThinkingLevelPreference(
  valueJson: string | null | undefined,
): ComposerThinkingLevel | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "off" ||
      parsed === "minimal" ||
      parsed === "low" ||
      parsed === "medium" ||
      parsed === "high" ||
      parsed === "xhigh"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function parseProjectDeletionModePreference(
  valueJson: string | null | undefined,
): ProjectDeletionMode | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "pi-only" || parsed === "full-clean" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseGitOpsModePreference(valueJson: string | null | undefined): GitOpsMode | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "commit" || parsed === "commit-push" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseGitDiffBaselineDefaultPreference(
  valueJson: string | null | undefined,
): ProjectDiffDefaultBaseline | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const baseline = parsed as { kind?: unknown };
    return baseline.kind === "head" ||
      baseline.kind === "previous" ||
      baseline.kind === "yesterday" ||
      baseline.kind === "main-branch" ||
      baseline.kind === "dev-branch"
      ? ({ kind: baseline.kind } as ProjectDiffDefaultBaseline)
      : null;
  } catch {
    return null;
  }
}

export function parseGitDiffRenderModePreference(
  valueJson: string | null | undefined,
): ProjectDiffRenderMode | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "stacked" || parsed === "split" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseComposerStreamingBehaviorPreference(
  valueJson: string | null | undefined,
): ComposerStreamingBehavior | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "steer" || parsed === "followUp" || parsed === "stop" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseDictationModelIdPreference(
  valueJson: string | null | undefined,
): DictationModelId | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "tiny.en" || parsed === "base.en" || parsed === "small.en" ? parsed : null;
  } catch {
    return null;
  }
}
