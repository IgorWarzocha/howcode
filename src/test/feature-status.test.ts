import { describe, expect, it } from "vitest";
import { getFeatureStatusDataAttributes } from "../app/features/feature-status";

describe("feature status helpers", () => {
  it("builds consistent data attributes from the feature registry", () => {
    expect(getFeatureStatusDataAttributes("feature:diff.panel")).toEqual({
      "data-feature-id": "feature:diff.panel",
      "data-feature-status": "partial",
    });
  });
});
