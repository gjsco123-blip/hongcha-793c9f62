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

  it("anchors 'we do' selection-start to 'we' (first word)", () => {
    const text = "In many ways, we do understand why nations cooperate.";
    const weIndex = text.indexOf("we");
    const doIndex = text.indexOf("do");

    const positions = computeSuperscriptPositions(text, [
      { id: 1, content: "강조구문: we do understand → do가 동사 강조", targetText: "we do", anchorMode: "selection-start" },
    ]);

    expect(positions.has(weIndex)).toBe(true);
    expect(positions.has(doIndex)).toBe(false);
  });

  it("anchors 'the need' selection-start to 'the' (first word)", () => {
    const text = "This reflects the need for greater international cooperation.";
    const theIndex = text.indexOf("the need") ;
    const needIndex = text.indexOf("need");

    const positions = computeSuperscriptPositions(text, [
      { id: 1, content: "명사구: the need for ~ = ~에 대한 필요성", targetText: "the need", anchorMode: "selection-start" },
    ]);

    expect(positions.has(theIndex)).toBe(true);
    // 'need' starts at theIndex + 4, should NOT have a separate anchor
    expect(positions.has(needIndex)).toBe(false);
  });

  it("heuristic mode still uses smart anchoring (not forced to first token)", () => {
    const text = "This reflects the need for greater international cooperation.";
    const positions = computeSuperscriptPositions(text, [
      { id: 1, content: "명사구: the need for ~ = ~에 대한 필요성", targetText: "the need" },
    ]);

    // Without anchorMode, heuristic may pick 'need' — that's acceptable for auto-generated notes
    expect(positions.size).toBe(1);
  });
});
