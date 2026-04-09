import { describe, expect, it } from "vitest";
import {
  buildModelMenuItems,
  buildModelSelectionPayload,
  getModelSettingValue,
  getProjectImportSummaryMessage,
} from "../app/views/settings/helpers";

describe("settings helpers", () => {
  it("formats model setting values", () => {
    expect(getModelSettingValue(null)).toBe("Use composer model");
    expect(getModelSettingValue({ provider: "openai", id: "gpt-5" })).toBe("openai/gpt-5");
  });

  it("builds menu items with current selection", () => {
    const items = buildModelMenuItems(
      { provider: "openai", id: "gpt-5" },
      { provider: "anthropic", id: "sonnet", name: "Sonnet", reasoning: true, input: ["text"] },
      [{ provider: "openai", id: "gpt-5", name: "GPT-5", reasoning: true, input: ["text"] }],
    );

    expect(items[0]?.selected).toBe(false);
    expect(items[1]).toMatchObject({ id: "openai/gpt-5", selected: true });
  });

  it("builds reset and explicit model payloads", () => {
    expect(buildModelSelectionPayload("gitCommitMessageModel", "composer-default")).toEqual({
      key: "gitCommitMessageModel",
      reset: true,
    });
    expect(buildModelSelectionPayload("skillCreatorModel", "openai/gpt-5")).toEqual({
      key: "skillCreatorModel",
      provider: "openai",
      modelId: "gpt-5",
    });
  });

  it("formats project import summaries", () => {
    expect(
      getProjectImportSummaryMessage({
        ok: true,
        at: "now",
        payload: { action: "projects.import.apply", payload: { projectIds: ["/repo"] } },
        result: { checkedProjectCount: 4, originProjectCount: 3 },
      }),
    ).toBe("Scanned 4 · Found 3 origins");

    expect(
      getProjectImportSummaryMessage({
        ok: true,
        at: "now",
        payload: { action: "projects.import.apply", payload: { projectIds: [] } },
        result: {},
      }),
    ).toBe("Nothing to scan");
  });
});
