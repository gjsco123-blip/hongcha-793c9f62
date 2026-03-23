import { describe, expect, it } from "vitest";
import { computeSuperscriptPositions } from "@/lib/syntax-superscript";

describe("computeSuperscriptPositions", () => {
  it("keeps a single-token manual selection anchored on the selected word", () => {
    const text = "Instead, the U.S. negotiators justified the project on the grounds that it would contribute to the country's industrial development.";
    const positions = computeSuperscriptPositions(text, [
      { id: 2, content: "지칭: it = the project", targetText: "it", anchorLocked: true },
    ]);

    const itMatch = /\bit\b/.exec(text);
    const itIndex = itMatch ? itMatch.index : -1;
    const projectIndex = text.indexOf("project");

    expect(itIndex).toBeGreaterThanOrEqual(0);
    expect(positions.has(itIndex)).toBe(true);
    expect(positions.has(projectIndex)).toBe(false);
  });

  it("keeps a multi-token manual selection anchored at the first selected token", () => {
    const text = "Loyalty to a company trumps pay and benefits. And unless you're an astronaut, it's not the work we do that inspires us either.";
    const positions = computeSuperscriptPositions(text, [
      {
        id: 2,
        content: "목적격 관계대명사 (which/that)가 생략된 형용사절(we do)이 선행사 the work를 수식",
        targetText: "we do",
        anchorLocked: true,
      },
    ]);

    const weMatch = /\bwe\b/.exec(text);
    const workMatch = /\bwork\b/.exec(text);
    const weIndex = weMatch ? weMatch.index : -1;
    const workIndex = workMatch ? workMatch.index : -1;

    expect(weIndex).toBeGreaterThanOrEqual(0);
    expect(workIndex).toBeGreaterThanOrEqual(0);
    expect(positions.has(weIndex)).toBe(true);
    expect(positions.has(workIndex)).toBe(false);
  });
});
