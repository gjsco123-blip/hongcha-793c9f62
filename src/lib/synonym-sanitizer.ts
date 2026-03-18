import type { SynAntItem } from "@/components/preview/types";

type SanitizeOptions = {
  filterByPassage?: boolean;
};

const PARTICLES = new Set([
  "to", "through", "onto", "into", "away", "off", "up", "down", "out",
  "over", "under", "in", "on", "for", "with", "from", "about", "around",
  "across", "back", "after", "before",
]);

const IRREGULAR_BASE: Record<string, string> = {
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  took: "take",
  has: "have",
  had: "have",
  having: "have",
  does: "do",
  did: "do",
  done: "do",
  doing: "do",
  goes: "go",
  went: "go",
  gone: "go",
  going: "go",
  lets: "let",
  kept: "keep",
  holds: "hold",
  paid: "pay",
  said: "say",
  laid: "lay",
  keeps: "keep",
  clings: "cling",
  sticks: "stick",
  adheres: "adhere",
  embraces: "embrace",
  advises: "advise",
  advised: "advise",
  guides: "guide",
  guided: "guide",
  mentors: "mentor",
  mentored: "mentor",
  neglects: "neglect",
  neglected: "neglect",
  ignores: "ignore",
  ignored: "ignore",
  counseled: "counsel",
  counseling: "counsel",
  counselling: "counsel",
  passed: "pass",
  survived: "survive",
  stepping: "step",
  taking: "take",
  staying: "stay",
  remaining: "remain",
  continuing: "continue",
  passing: "pass",
  venturing: "venture",
  clinging: "cling",
  sticking: "stick",
  adhering: "adhere",
  embracing: "embrace",
  holding: "hold",
  keeping: "keep",
  advising: "advise",
  guiding: "guide",
  mentoring: "mentor",
  neglecting: "neglect",
  ignoring: "ignore",
  survives: "survive",
  undergoing: "undergo",
  experiencing: "experience",
  enduring: "endure",
  avoiding: "avoid",
  bypassing: "bypass",
};

const normalizeSpaces = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

const normalizeEnglish = (s: string) =>
  normalizeSpaces(
    s
      .replace(/[’`]/g, "'")
      .replace(/^[^a-zA-Z']+|[^a-zA-Z'\s-]+$/g, "")
      .toLowerCase()
  );

const toKoreanDictionaryForm = (token: string) => {
  const t = normalizeSpaces(token);
  if (!t) return t;
  if (t.endsWith("했다")) return `${t.slice(0, -2)}하다`;
  if (t.endsWith("하였습니다")) return `${t.slice(0, -5)}하다`;
  return t;
};

const splitKoreanPhrases = (text: string) => {
  const cleaned = normalizeSpaces(text);
  if (!cleaned) return [];
  if (cleaned.includes(",")) return cleaned.split(",").map((p) => p.trim()).filter(Boolean);

  // Handle model outputs like "세상을 떠나다 사망하다" (missing comma).
  const phrases = cleaned.match(/[^,]+?다(?=\s|$)/g)?.map((p) => p.trim()).filter(Boolean) || [];
  if (phrases.length >= 2) {
    const recomposed = normalizeSpaces(phrases.join(" "));
    if (recomposed === cleaned) return phrases;
  }
  return [cleaned];
};

const normalizeKoreanMeaning = (s: string) =>
  splitKoreanPhrases(s.replace(/[()]/g, ""))
    .map((part) => toKoreanDictionaryForm(part))
    .join(", ");

const splitEntry = (raw: string) => {
  const text = normalizeSpaces(raw);
  const first = text.indexOf("(");
  const last = text.lastIndexOf(")");
  if (first !== -1 && last > first) {
    return {
      en: normalizeSpaces(text.slice(0, first)),
      ko: normalizeKoreanMeaning(text.slice(first + 1, last)),
    };
  }
  return { en: text, ko: "" };
};

const joinEntry = (en: string, ko: string) => (ko ? `${en} (${ko})` : en);

const hasDoubleFinalConsonant = (word: string) => {
  if (word.length < 2) return false;
  const last = word.at(-1) ?? "";
  const prev = word.at(-2) ?? "";
  return last === prev && "bdgklmnprt".includes(last);
};

const NOUN_LIKE_SUFFIXES = [
  "ous", "sis", "ness", "less", "ics", "itis", "osis", "iasis", "ment",
  "ance", "ence", "ity", "ship", "hood", "dom", "ism", "ure", "age",
];

const shouldPreserveNounLikeForm = (word: string) => {
  if (!word) return false;
  if (word.endsWith("us") || word.endsWith("is") || word.endsWith("os") || word.endsWith("ous")) return true;
  return NOUN_LIKE_SUFFIXES.some((suffix) => word.endsWith(suffix));
};

const shouldRestoreSilentE = (base: string) =>
  /[aeiou][^aeiouwxy]$/.test(base) && !hasDoubleFinalConsonant(base);

const toBaseToken = (token: string) => {
  const clean = normalizeEnglish(token);
  if (!clean) return "";
  if (IRREGULAR_BASE[clean]) return IRREGULAR_BASE[clean];
  if (shouldPreserveNounLikeForm(clean)) return clean;
  if (clean.endsWith("ing") && clean.length > 4) {
    let base = clean.slice(0, -3);
    if (IRREGULAR_BASE[base]) return IRREGULAR_BASE[base];
    if (hasDoubleFinalConsonant(base)) {
      base = base.slice(0, -1);
      if (IRREGULAR_BASE[base]) return IRREGULAR_BASE[base];
    }
    if (shouldRestoreSilentE(base)) return base + "e";
    return base;
  }
  if (clean === "died") return "die";
  if (clean.endsWith("ied") && clean.length > 3) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith("ies") && clean.length > 4) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith("ed") && clean.length > 3) {
    let base = clean.slice(0, -2);
    if (IRREGULAR_BASE[base]) return IRREGULAR_BASE[base];
    if (hasDoubleFinalConsonant(base)) {
      base = base.slice(0, -1);
      if (IRREGULAR_BASE[base]) return IRREGULAR_BASE[base];
    }
    if (base.endsWith("i")) return `${base.slice(0, -1)}y`;
    return base;
  }
  if (/(ches|shes|xes|zes|oes|sses)$/.test(clean)) return clean.slice(0, -2);
  if (clean.endsWith("s") && clean.length > 3 && !clean.endsWith("ss") && !shouldPreserveNounLikeForm(clean)) return clean.slice(0, -1);
  return clean;
};

const tokenizeEnglish = (s: string) => normalizeEnglish(s).split(" ").filter(Boolean);

const normalizeVerbPhraseHead = (en: string, ko: string) => {
  const tokens = tokenizeEnglish(en);
  if (tokens.length === 0) return "";

  const verbLikeByMeaning = ko.endsWith("다");
  const verbLikeByPhrase = tokens.length > 1 && PARTICLES.has(tokens[1]);
  if (!verbLikeByMeaning && !verbLikeByPhrase) return tokens.join(" ");

  const [head, ...rest] = tokens;
  return [toBaseToken(head), ...rest].join(" ").trim();
};

const normalizeWordHead = (en: string, ko: string) => {
  const tokens = tokenizeEnglish(en);
  if (tokens.length === 0) return "";

  const verbLikeByMeaning = ko.endsWith("다");
  const verbLikeByPhrase = tokens.length > 1 && PARTICLES.has(tokens[1]);
  if (verbLikeByMeaning || verbLikeByPhrase) {
    const [head, ...rest] = tokens;
    return [toBaseToken(head), ...rest].join(" ").trim();
  }

  if (tokens.length === 1) {
    return toBaseToken(tokens[0]);
  }

  return tokens.join(" ");
};

const normalizeChipField = (raw: string) => {
  const chips = raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chip) => {
      const { en, ko } = splitEntry(chip);
      const normalizedEn = normalizeEnglish(en);
      return joinEntry(normalizedEn, ko);
    })
    .filter(Boolean);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const chip of chips) {
    const key = splitEntry(chip).en;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(chip);
  }
  return deduped.join(", ");
};

const appearsInPassage = (wordEn: string, passage: string) => {
  const target = tokenizeEnglish(wordEn);
  if (target.length === 0) return false;
  const passageTokens = (String(passage).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).map((t) => normalizeEnglish(t));
  if (passageTokens.length < target.length) return false;

  const targetLemmas = target.map(toBaseToken);
  for (let i = 0; i <= passageTokens.length - targetLemmas.length; i++) {
    let ok = true;
    for (let j = 0; j < targetLemmas.length; j++) {
      if (toBaseToken(passageTokens[i + j]) !== targetLemmas[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
};

export function sanitizeSynonymItems(items: SynAntItem[], passage: string, options: SanitizeOptions = {}): SynAntItem[] {
  const filterByPassage = !!options.filterByPassage;

  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => {
      const { en, ko } = splitEntry(item.word);
      const normalizedWordEn = normalizeWordHead(en, ko);
      const word = joinEntry(normalizedWordEn, ko);
      return {
        word,
        synonym: normalizeChipField(item.synonym || ""),
        antonym: normalizeChipField(item.antonym || ""),
      };
    })
    .filter((item) => splitEntry(item.word).en);

  const deduped: SynAntItem[] = [];
  const seen = new Set<string>();
  for (const item of normalized) {
    const key = splitEntry(item.word).en;
    if (seen.has(key)) continue;
    if (filterByPassage && !appearsInPassage(key, passage)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}
