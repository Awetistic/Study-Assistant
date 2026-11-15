import { buildSystemPrompt, DECK_SCHEMA } from "../prompt.js";
import { ApiError } from "../errors.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Calls Gemini's REST API directly with fetch (no SDK), so every step is visible.
 * Returns the model's raw text. Parsing/validation is NOT done here on purpose:
 * the client owns that, so it can show partial results and specific errors.
 */
export async function generateWithGemini({ text, count, signal }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    throw new ApiError(500, "NO_KEY", "The server has no GEMINI_API_KEY. Add it to .env, or set AI_PROVIDER=mock.");
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(count) }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: DECK_SCHEMA,
        },
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err; // let the route handle timeouts/cancels
    throw new ApiError(502, "UPSTREAM", "Couldn't reach the AI provider.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[gemini] HTTP ${response.status}: ${body.slice(0, 500)}`);
    if (response.status === 429) throw new ApiError(429, "RATE_LIMIT", "The AI is rate-limited right now. Wait a few seconds and retry.");
    if (response.status === 400 || response.status === 403) throw new ApiError(502, "UPSTREAM", "The AI provider rejected the request (check the API key and model name).");
    if (response.status === 404) throw new ApiError(502, "UPSTREAM", `Model "${model}" wasn't found. Update GEMINI_MODEL in .env.`);
    throw new ApiError(502, "UPSTREAM", `The AI provider returned an error (${response.status}).`);
  }

  const data = await response.json();

  if (data.promptFeedback?.blockReason) {
    throw new ApiError(422, "BLOCKED", "The AI declined to process this text. Try different notes.");
  }

  const candidate = data.candidates?.[0];
  const raw = (candidate?.content?.parts || []).map((p) => p.text || "").join("");

  // A response cut off by the token limit is almost always broken JSON.
  // We still pass it on: the client will try to salvage it and explain if it can't.
  return { raw, finishReason: candidate?.finishReason ?? null, model };
}
