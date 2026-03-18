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
    expect(out[0].synonym).toBe("advised (조언하다), guided (지도하다), mentored (멘토링하다)");
    expect(out[0].antonym).toBe("neglected (방치하다), ignored (무시하다)");
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

  it("normalizes took place to take place", () => {
    const out = sanitizeSynonymItems(
      [
        {
          word: "took place (개최되다, 일어나다)",
          synonym: "occurred (발생하다), happened (일어나다)",
          antonym: "be held (개최되다)",
        },
      ],
      "The event took place last week."
    );

    expect(out[0].word).toBe("take place (개최되다, 일어나다)");
    expect(out[0].synonym).toBe("occurred (발생하다), happened (일어나다)");
    expect(out[0].antonym).toBe("be held (개최되다)");
  });

  it("normalizes gerund verb phrases but keeps noun-like focus intact", () => {
    const out = sanitizeSynonymItems(
      [
        {
          word: "stepping out (도전하다)",
          synonym: "venturing (모험하다), taking a risk (위험을 무릅쓰다)",
          antonym: "staying (머무르다), remaining (남아 있다)",
        },
        {
          word: "focus on (집중하다)",
          synonym: "concentrate on (에 집중하다)",
          antonym: "ignore (를 무시하다)",
        },
      ],
      "I felt that stepping out of my comfort zone would have such a positive effect on how I felt about myself."
    );

    expect(out[0].word).toBe("step out (도전하다)");
    expect(out[0].synonym).toBe("venturing (모험하다), taking a risk (위험을 무릅쓰다)");
    expect(out[0].antonym).toBe("staying (머무르다), remaining (남아 있다)");
    expect(out[1].word).toBe("focus on (집중하다)");
  });

  it("keeps synonym and antonym chip spelling intact while normalizing Korean glosses", () => {
    const out = sanitizeSynonymItems(
      [
        {
          word: "deal with (처리하다, 대처하다)",
          synonym: "handled (다루다), coped with (대처하다), tackled (씨름하다)",
          antonym: "ignored (무시하다), neglected (방치하다)",
        },
      ],
      "You need to deal with the problem carefully."
    );

    expect(out[0].synonym).toBe("handled (다루다), coped with (대처하다), tackled (씨름하다)");
    expect(out[0].antonym).toBe("ignored (무시하다), neglected (방치하다)");
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
      [
        { word: "focus on (집중하다)", synonym: "concentrate on (집중하다)", antonym: "" },
        { word: "analysis (분석)", synonym: "examination (검토)", antonym: "" },
      ],
      "You should focus on your studies."
    );
    expect(out[0].word).toBe("focus on (집중하다)");
    expect(out[1].word).toBe("analysis (분석)");
  });
});
