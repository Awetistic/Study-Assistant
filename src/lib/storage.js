import { validateDeck } from "./parseDeck.js";

const KEY = "study-assistant:sessions:v1";
const MAX_SESSIONS = 15;

/**
 * Saved data is treated like model output: it can be old, edited by hand, or corrupted,
 * so every deck goes back through validateDeck on load. Bad entries are dropped quietly.
 */
export function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((s) => {
      try {
        if (!s || typeof s.id !== "string") return [];
        const { deck } = validateDeck(s.deck);
        return [{ id: s.id, createdAt: Number(s.createdAt) || Date.now(), input: String(s.input || ""), deck, warnings: [] }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    const slim = sessions.slice(0, MAX_SESSIONS).map(({ id, createdAt, input, deck }) => ({ id, createdAt, input, deck }));
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    // Storage full or blocked (e.g. private mode). The app still works; it just won't remember.
  }
}

export function newSessionId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
