import { describe, expect, it } from "vitest";
import { assertRecommendationPreviewIntegrity } from "@/lib/recommendations/preview-map";

describe("recommendation preview map", () => {
  it("has unique recommendation ids and complete mappings", () => {
    expect(() => assertRecommendationPreviewIntegrity()).not.toThrow();
  });
});
