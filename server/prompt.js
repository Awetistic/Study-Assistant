// The prompt and JSON schema we send to the model.
// The schema is a *request*, not a guarantee: the client still validates
// everything it gets back (see src/lib/parseDeck.js).

export function buildSystemPrompt(count) {
  return `You are a study assistant. Turn the user's notes or topic into study material.

Return ONLY a JSON object, no prose, no markdown fences, with this shape:
{
  "title": string,                     // short title for the deck, max 60 chars
  "cards": [                           // exactly ${count} flashcards
    { "front": string, "back": string }  // front = question or term, back = concise answer
  ],
  "quiz": [                            // exactly ${count} multiple-choice questions
    {
      "question": string,
      "options": [string, string, string, string],  // 4 distinct options
      "answerIndex": number,           // 0-3, index of the correct option
      "explanation": string            // one sentence on why it's correct
    }
  ]
}

Rules:
- Base everything on the user's text. If they only gave a topic, use well-established facts.
- Keep card backs under 40 words.
- Wrong options must be plausible, not jokes.
- Vary the position of the correct answer.
- If the input is not something you can study (gibberish, empty), return {"title": "", "cards": [], "quiz": []}.`;
}

// Gemini's structured-output schema (an OpenAPI subset).
export const DECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    cards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          front: { type: "STRING" },
          back: { type: "STRING" },
        },
        required: ["front", "back"],
      },
    },
    quiz: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answerIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["question", "options", "answerIndex"],
      },
    },
  },
  required: ["title", "cards", "quiz"],
};
