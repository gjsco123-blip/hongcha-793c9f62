import { describe, expect, it } from "vitest";
import { computeSuperscriptPositions } from "@/lib/syntax-superscript";

describe("computeSuperscriptPositions", () => {
  it("keeps a single-token manual selection anchored on the selected word", () => {
    const text = "Instead, the U.S. negotiators justified the project on the grounds that it would contribute to the country's industrial development.";
    const positions = computeSuperscriptPositions(text, [
      { id: 2, content: "지칭: it = the project", targetText: "it" },
    ]);

    const itIndex = text.indexOf("it");
    const projectIndex = text.indexOf("project");

    expect(positions.has(itIndex)).toBe(true);
    expect(positions.has(projectIndex)).toBe(false);
  });
});
