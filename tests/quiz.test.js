import { describe, it, expect } from "vitest";
import { buildRound, scoreRound } from "../src/lib/quiz.js";

const questions = [
  { id: "q0", question: "2+2?", options: ["3", "4", "5"], answerIndex: 1, explanation: null },
  { id: "q1", question: "Capital of France?", options: ["Paris", "Rome"], answerIndex: 0, explanation: null },
];

describe("buildRound", () => {
  it("keeps every correct answer pointing at the right text after shuffling", () => {
    for (let run = 0; run < 50; run++) {
      const round = buildRound(questions);
      for (const item of round) {
        const original = questions.find((q) => q.id === item.id);
        expect(item.options[item.answerIndex]).toBe(original.options[original.answerIndex]);
        expect([...item.options].sort()).toEqual([...original.options].sort());
      }
    }
  });
});

describe("scoreRound", () => {
  it("counts correct answers and lists the wrong ones", () => {
    const items = buildRound(questions);
    const answers = { [items[0].id]: items[0].answerIndex }; // second one unanswered = wrong
    expect(scoreRound(items, answers)).toEqual({ correct: 1, total: 2, wrongIds: [items[1].id] });
  });
});
