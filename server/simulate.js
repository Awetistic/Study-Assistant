import { buildMockDeck } from "./providers/mock.js";
import { ApiError } from "./errors.js";

// Each mode reproduces a real way LLM calls go wrong, so the UI's handling can be
// demoed on demand instead of waiting for the model to misbehave.
export const SIMULATE_MODES = {
  malformed: "Truncated JSON (like hitting the token limit)",
  fenced: "Valid JSON wrapped in prose + ```json fences",
  wrong_shape: "Valid JSON, wrong structure",
  partial: "Some good items, some broken ones",
  empty: "Empty response",
  slow: "Never answers (hits the timeout)",
  error: "Provider 500 error",
  rate_limit: "Provider 429 rate limit",
};

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
  });

export async function simulate(mode, { text, count, signal }) {
  await wait(700, signal);
  const deck = buildMockDeck(text, count);
  const json = JSON.stringify(deck);

  switch (mode) {
    case "malformed":
      return { raw: json.slice(0, Math.floor(json.length * 0.6)), finishReason: "MAX_TOKENS", model: "simulated" };
    case "fenced":
      return { raw: `Sure! Here are your study materials:\n\n\`\`\`json\n${JSON.stringify(deck, null, 2)}\n\`\`\`\n\nGood luck!`, finishReason: "STOP", model: "simulated" };
    case "wrong_shape":
      return { raw: JSON.stringify({ flashcards: "Here are some cards about your topic", questions: 5 }), finishReason: "STOP", model: "simulated" };
    case "partial": {
      const broken = {
        ...deck,
        cards: [...deck.cards, { front: "Card with no answer" }, { front: "", back: "" }, deck.cards[0]].filter(Boolean),
        quiz: [
          ...deck.quiz,
          { question: "Question whose answer is out of range", options: ["A", "B", "C"], answerIndex: 7 },
          { question: "Question with one option", options: ["Only"], answerIndex: 0 },
          { question: "Numeric answerIndex as string", options: ["Yes", "No", "Maybe"], answerIndex: "1", explanation: "Should be coerced." },
        ],
      };
      return { raw: JSON.stringify(broken), finishReason: "STOP", model: "simulated" };
    }
    case "empty":
      return { raw: "", finishReason: "STOP", model: "simulated" };
    case "slow":
      await wait(120_000, signal);
      return { raw: json, finishReason: "STOP", model: "simulated" };
    case "error":
      throw new ApiError(502, "UPSTREAM", "The AI provider returned an error (500).");
    case "rate_limit":
      throw new ApiError(429, "RATE_LIMIT", "The AI is rate-limited right now. Wait a few seconds and retry.");
    default:
      throw new ApiError(400, "BAD_INPUT", `Unknown simulate mode "${mode}".`);
  }
}
