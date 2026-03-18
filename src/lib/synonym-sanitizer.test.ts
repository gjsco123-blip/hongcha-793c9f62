import { describe, expect, it } from "vitest";
import { sanitizeSynonymItems } from "@/lib/synonym-sanitizer";

describe("sanitizeSynonymItems", () => {
  it("normalizes verb forms and Korean dictionary forms", () => {
    const out = sanitizeSynonymItems(
      [
        {
          word: "counseled (상담했다)",
          synonym: "advised (조언했다), guided (지도했다), mentored (멘토링했다)",
          antonym: "neglected (방치했다), ignored (무시했다)",
        },
      ],
      "I counseled her and helped her begin her recovery journey."
    );

    expect(out[0].word).toBe("counsel (상담하다)");
    expect(out[0].synonym).toBe("advise (조언하다), guide (지도하다), mentor (멘토링하다)");
    expect(out[0].antonym).toBe("neglect (방치하다), ignore (무시하다)");
  });

  it("normalizes phrasal verbs and fixes missing Korean separators", () => {
    const out = sanitizeSynonymItems(
      [
        {
          word: "passed away (세상을 떠나다 사망했다)",
          synonym: "died (죽었다)",
          antonym: "survived (살아남았다)",
        },
      ],
      "A difficult time after her mom passed away."
    );

    expect(out[0].word).toBe("pass away (세상을 떠나다, 사망하다)");
    expect(out[0].synonym).toBe("died (죽었다)");
    expect(out[0].antonym).toBe("survived (살아남았다)");
  });

  it("filters entries not present in passage when filterByPassage is enabled", () => {
    const out = sanitizeSynonymItems(
      [
        { word: "professional (전문적인)", synonym: "expert (전문가적인)", antonym: "amateur (아마추어의)" },
        { word: "going through (어려움을 겪다)", synonym: "undergoing (경험하다)", antonym: "avoiding (피하다)" },
      ],
      "One patient of mine was going through a difficult time.",
      { filterByPassage: true }
    );

    expect(out).toHaveLength(1);
    expect(out[0].word).toBe("go through (어려움을 겪다)");
  });

  it("preserves Latin-root words ending in -us/-is/-os/-ous", () => {
    const out = sanitizeSynonymItems(
      [{ word: "focus on (집중하다)", synonym: "concentrate on (집중하다)", antonym: "" }],
      "You should focus on your studies."
    );
    expect(out[0].word).toBe("focus on (집중하다)");
  });
});

