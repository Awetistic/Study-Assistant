import { describe, it, expect } from "vitest";
import { parseDeck, extractJson, validateDeck, findJsonObject, DeckError } from "../src/lib/parseDeck.js";

const good = {
  title: "Photosynthesis",
  cards: [
    { front: "Where does photosynthesis happen?", back: "In chloroplasts." },
    { front: "What gas is released?", back: "Oxygen." },
  ],
  quiz: [
    { question: "What pigment captures light?", options: ["Chlorophyll", "Keratin", "Melanin", "Hemoglobin"], answerIndex: 0, explanation: "Chlorophyll absorbs light." },
  ],
};

const kindOf = (fn) => {
  try { fn(); } catch (e) { return e instanceof DeckError ? e.kind : `other:${e.message}`; }
  return "no error";
};

describe("extractJson", () => {
  it("parses clean JSON", () => {
    expect(extractJson(JSON.stringify(good))).toEqual({ value: good, repaired: false });
  });

  it("recovers JSON wrapped in prose and fences", () => {
    const raw = "Sure! Here you go:\n```json\n" + JSON.stringify(good) + "\n```\nHope this helps";
    const { value, repaired } = extractJson(raw);
    expect(value.title).toBe("Photosynthesis");
    expect(repaired).toBe(true);
  });

  it("recovers JSON with prose but no fences", () => {
    const { value } = extractJson("Here: " + JSON.stringify(good) + " Enjoy!");
    expect(value.cards).toHaveLength(2);
  });

  it("ignores braces inside strings when finding the object", () => {
    const obj = { title: "Sets {a, b}", cards: [{ front: "What is } ?", back: "A brace" }], quiz: [] };
    expect(findJsonObject("prefix " + JSON.stringify(obj) + " suffix")).toBe(JSON.stringify(obj));
  });

  it("flags empty responses", () => {
    expect(kindOf(() => extractJson(""))).toBe("EMPTY");
    expect(kindOf(() => extractJson("   \n"))).toBe("EMPTY");
    expect(kindOf(() => extractJson(undefined))).toBe("EMPTY");
  });

  it("flags truncated output", () => {
    const cut = JSON.stringify(good).slice(0, 60);
    expect(kindOf(() => extractJson(cut))).toBe("TRUNCATED");
  });

  it("flags non-JSON text", () => {
    expect(kindOf(() => extractJson("I'm sorry, I can't help with that."))).toBe("MALFORMED");
  });
});

describe("validateDeck", () => {
  it("accepts a good deck and adds ids", () => {
    const { deck, warnings } = validateDeck(good);
    expect(deck.cards.map((c) => c.id)).toEqual(["c0", "c1"]);
    expect(deck.quiz[0]).toMatchObject({ id: "q0", answerIndex: 0 });
    expect(warnings).toEqual([]);
  });

  it("rejects the wrong shape", () => {
    expect(kindOf(() => validateDeck([1, 2, 3]))).toBe("WRONG_SHAPE");
    expect(kindOf(() => validateDeck({ flashcards: "some text", questions: 5 }))).toBe("WRONG_SHAPE");
    expect(kindOf(() => validateDeck(null))).toBe("WRONG_SHAPE");
  });

  it("reports when the model says there's nothing to study", () => {
    expect(kindOf(() => validateDeck({ title: "", cards: [], quiz: [] }))).toBe("NOT_STUDYABLE");
  });

  it("errors when every item is broken", () => {
    const v = { cards: [{ front: "no back" }], quiz: [{ question: "x", options: ["a"], answerIndex: 0 }] };
    expect(kindOf(() => validateDeck(v))).toBe("NO_USABLE_ITEMS");
  });

  it("salvages good items and explains what was dropped", () => {
    const v = {
      title: "Mixed",
      cards: [...good.cards, { front: "missing back" }, null, good.cards[0]],
      quiz: [
        ...good.quiz,
        { question: "Out of range", options: ["a", "b"], answerIndex: 5 },
        { question: "One option", options: ["a"], answerIndex: 0 },
      ],
    };
    const { deck, warnings } = validateDeck(v);
    expect(deck.cards).toHaveLength(2);
    expect(deck.quiz).toHaveLength(1);
    expect(warnings.join(" ")).toMatch(/2 flashcards missing/);
    expect(warnings.join(" ")).toMatch(/1 duplicate flashcard/);
    expect(warnings.join(" ")).toMatch(/no valid correct answer/);
    expect(warnings.join(" ")).toMatch(/too few answer options/);
  });

  it("coerces a numeric-string answerIndex", () => {
    const { deck } = validateDeck({ cards: [], quiz: [{ question: "Q?", options: ["a", "b", "c"], answerIndex: "2" }] });
    expect(deck.quiz[0].answerIndex).toBe(2);
  });

  it("falls back to an `answer` string when answerIndex is missing", () => {
    const { deck } = validateDeck({ cards: [], quiz: [{ question: "Q?", options: ["Paris", "Rome"], answer: "rome" }] });
    expect(deck.quiz[0].answerIndex).toBe(1);
  });

  it("keeps the right answer when duplicate options are removed", () => {
    const { deck } = validateDeck({ cards: [], quiz: [{ question: "Q?", options: ["A", "a", "B", "C"], answerIndex: 3 }] });
    expect(deck.quiz[0].options).toEqual(["A", "B", "C"]);
    expect(deck.quiz[0].options[deck.quiz[0].answerIndex]).toBe("C");
  });

  it("accepts common alternative key names", () => {
    const { deck } = validateDeck({ flashcards: [{ term: "Mitosis", definition: "Cell division" }], questions: [] });
    expect(deck.cards[0]).toMatchObject({ front: "Mitosis", back: "Cell division" });
  });

  it("warns when fewer items came back than requested", () => {
    const { warnings } = validateDeck(good, { requestedCount: 5 });
    expect(warnings).toContain("Got 2 of 5 flashcards.");
  });

  it("defaults a missing title", () => {
    expect(validateDeck({ cards: good.cards }).deck.title).toBe("Untitled deck");
  });
});

describe("parseDeck", () => {
  it("notes when it had to repair the output", () => {
    const { warnings } = parseDeck("```json\n" + JSON.stringify(good) + "\n```");
    expect(warnings[0]).toMatch(/extra text/);
  });
});
