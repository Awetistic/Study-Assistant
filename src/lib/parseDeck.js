/**
 * Turns whatever the model sent back into a deck the UI can trust.
 *
 * Two stages:
 *   1. extractJson   - get a JS value out of the raw text (handles fences, prose, truncation)
 *   2. validateDeck  - check the shape item by item, keep what's usable, drop what isn't
 *
 * Philosophy: salvage over all-or-nothing. If the model returns 8 good cards and 2 broken
 * ones, the user gets 8 cards and a small note - not an error screen.
 */

export class DeckError extends Error {
  /** @param {"EMPTY"|"MALFORMED"|"TRUNCATED"|"WRONG_SHAPE"|"NOT_STUDYABLE"|"NO_USABLE_ITEMS"} kind */
  constructor(kind, message) {
    super(message);
    this.name = "DeckError";
    this.kind = kind;
  }
}

const MAX_TEXT = 600;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

// ---------- Stage 1: raw text -> JS value ----------

/**
 * Finds the first balanced {...} block in a string, ignoring braces inside JSON strings.
 * Returns null if the object never closes (a strong sign the output was cut off).
 */
export function findJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * @returns {{ value: unknown, repaired: boolean }}
 */
export function extractJson(raw, { finishReason } = {}) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new DeckError("EMPTY", "The AI sent back an empty response.");
  }
  const text = raw.trim();

  // Happy path: the whole thing is JSON.
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch {
    /* fall through to recovery */
  }

  // Common case: ```json ... ``` fences and/or chatty text around the object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], findJsonObject(text)].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return { value: JSON.parse(candidate.trim()), repaired: true };
    } catch {
      /* try next */
    }
  }

  const looksCutOff = finishReason === "MAX_TOKENS" || (text.includes("{") && findJsonObject(text) === null);
  if (looksCutOff) {
    throw new DeckError("TRUNCATED", "The AI's answer got cut off partway through.");
  }
  throw new DeckError("MALFORMED", "The AI's answer wasn't valid JSON.");
}

// ---------- Stage 2: JS value -> validated deck ----------

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Returns a trimmed, length-capped string, or "" if the value isn't usable text. */
function cleanText(value) {
  if (typeof value === "number") value = String(value);
  if (typeof value !== "string") return "";
  const t = value.replace(/\s+/g, " ").trim();
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT - 1) + "…" : t;
}

/** First array found under any of the given keys (models drift between names). */
function pickArray(obj, keys) {
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  return null;
}

function validateCard(item) {
  if (!isPlainObject(item)) return null;
  const front = cleanText(item.front ?? item.question ?? item.term);
  const back = cleanText(item.back ?? item.answer ?? item.definition);
  if (!front || !back) return null;
  return { front, back };
}

function validateQuestion(item) {
  if (!isPlainObject(item)) return { error: "invalid" };
  const question = cleanText(item.question ?? item.prompt);
  if (!question) return { error: "invalid" };

  if (!Array.isArray(item.options)) return { error: "invalid" };
  // Clean options and drop blanks/duplicates, remembering where each original index went.
  const options = [];
  const indexMap = new Map(); // original index -> new index
  item.options.forEach((opt, i) => {
    const t = cleanText(opt);
    if (!t) return;
    const existing = options.findIndex((o) => o.toLowerCase() === t.toLowerCase());
    if (existing !== -1) {
      indexMap.set(i, existing);
      return;
    }
    indexMap.set(i, options.length);
    options.push(t);
  });
  if (options.length < MIN_OPTIONS) return { error: "options" };
  if (options.length > MAX_OPTIONS) options.length = MAX_OPTIONS;

  // answerIndex can arrive as 2, "2", or be missing with an "answer" string instead.
  let answerIndex = null;
  const rawIndex = typeof item.answerIndex === "string" ? Number(item.answerIndex) : item.answerIndex;
  if (Number.isInteger(rawIndex) && indexMap.has(rawIndex)) {
    answerIndex = indexMap.get(rawIndex);
  } else if (typeof item.answer === "string") {
    const found = options.findIndex((o) => o.toLowerCase() === item.answer.trim().toLowerCase());
    if (found !== -1) answerIndex = found;
  }
  if (answerIndex === null || answerIndex >= options.length) return { error: "answer" };

  return {
    value: { question, options, answerIndex, explanation: cleanText(item.explanation) || null },
  };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * @returns {{ deck: { title: string, cards: Array, quiz: Array }, warnings: string[] }}
 */
export function validateDeck(value, { requestedCount } = {}) {
  if (!isPlainObject(value)) {
    throw new DeckError("WRONG_SHAPE", "The AI's answer didn't have the expected structure.");
  }

  const rawCards = pickArray(value, ["cards", "flashcards"]);
  const rawQuiz = pickArray(value, ["quiz", "questions"]);
  if (!rawCards && !rawQuiz) {
    throw new DeckError("WRONG_SHAPE", "The AI's answer didn't contain any flashcards or quiz questions.");
  }
  if ((rawCards?.length ?? 0) === 0 && (rawQuiz?.length ?? 0) === 0) {
    throw new DeckError("NOT_STUDYABLE", "The AI couldn't find anything to study in that text.");
  }

  const warnings = [];

  // Cards
  const cards = [];
  const seenFronts = new Set();
  let badCards = 0;
  let dupCards = 0;
  for (const item of rawCards ?? []) {
    const card = validateCard(item);
    if (!card) { badCards++; continue; }
    const key = card.front.toLowerCase();
    if (seenFronts.has(key)) { dupCards++; continue; }
    seenFronts.add(key);
    cards.push({ id: `c${cards.length}`, ...card });
  }
  if (badCards) warnings.push(`Skipped ${plural(badCards, "flashcard")} missing a question or answer.`);
  if (dupCards) warnings.push(`Removed ${plural(dupCards, "duplicate flashcard")}.`);

  // Quiz
  const quiz = [];
  const seenQuestions = new Set();
  const qErrors = { invalid: 0, options: 0, answer: 0, dup: 0 };
  for (const item of rawQuiz ?? []) {
    const result = validateQuestion(item);
    if (result.error) { qErrors[result.error]++; continue; }
    const key = result.value.question.toLowerCase();
    if (seenQuestions.has(key)) { qErrors.dup++; continue; }
    seenQuestions.add(key);
    quiz.push({ id: `q${quiz.length}`, ...result.value });
  }
  if (qErrors.invalid) warnings.push(`Skipped ${plural(qErrors.invalid, "quiz question")} that were malformed.`);
  if (qErrors.options) warnings.push(`Skipped ${plural(qErrors.options, "quiz question")} with too few answer options.`);
  if (qErrors.answer) warnings.push(`Skipped ${plural(qErrors.answer, "quiz question")} with no valid correct answer.`);
  if (qErrors.dup) warnings.push(`Removed ${plural(qErrors.dup, "duplicate question")}.`);

  if (cards.length === 0 && quiz.length === 0) {
    throw new DeckError("NO_USABLE_ITEMS", "Everything the AI returned was broken, so there's nothing to show.");
  }

  if (requestedCount) {
    if (cards.length && cards.length < requestedCount) warnings.push(`Got ${cards.length} of ${requestedCount} flashcards.`);
    if (quiz.length && quiz.length < requestedCount) warnings.push(`Got ${quiz.length} of ${requestedCount} quiz questions.`);
  }
  if (!cards.length) warnings.push("No usable flashcards came back - only the quiz is available.");
  if (!quiz.length) warnings.push("No usable quiz questions came back - only flashcards are available.");

  const title = cleanText(value.title).slice(0, 80) || "Untitled deck";
  return { deck: { title, cards, quiz }, warnings };
}

/** Full pipeline used by the app. */
export function parseDeck(raw, { finishReason, requestedCount } = {}) {
  const { value, repaired } = extractJson(raw, { finishReason });
  const { deck, warnings } = validateDeck(value, { requestedCount });
  if (repaired) warnings.unshift("The AI wrapped its answer in extra text; we pulled the data out.");
  return { deck, warnings };
}
