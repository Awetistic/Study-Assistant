import { useCallback, useEffect, useRef, useState } from "react";
import { requestDeck, AppError } from "../lib/api.js";
import { parseDeck, DeckError } from "../lib/parseDeck.js";

export const CLIENT_TIMEOUT_MS = 30_000;

// Friendly copy for each failure kind. `retryable: false` hides the Retry button.
const DECK_ERROR_COPY = {
  EMPTY: "The AI sent back an empty response.",
  MALFORMED: "The AI's answer wasn't in a format we could read.",
  TRUNCATED: "The AI's answer got cut off partway through. Asking for fewer cards often helps.",
  WRONG_SHAPE: "The AI answered, but not with flashcards and quiz questions.",
  NOT_STUDYABLE: "The AI couldn't find anything to study in that text. Try adding more detail.",
  NO_USABLE_ITEMS: "Everything the AI returned was broken, so there's nothing to show.",
};

/**
 * Owns one in-flight generation at a time.
 *
 * Guarantees:
 *  - Starting a new request aborts the previous one (we stop waiting AND the server stops paying).
 *  - A response that arrives after a newer request started is ignored (requestId check),
 *    so a slow old answer can never overwrite a newer one.
 *  - Every outcome ends in exactly one of: success, error, or silently superseded.
 */
export function useDeckGenerator() {
  const [state, setState] = useState({ status: "idle", error: null, startedAt: null });
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const lastArgsRef = useRef(null);

  // Abort anything still running if the component unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = useCallback(async (args) => {
    controllerRef.current?.abort(); // supersede the previous request
    const controller = new AbortController();
    controllerRef.current = controller;
    const myId = ++requestIdRef.current;
    lastArgsRef.current = args;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    setState({ status: "loading", error: null, startedAt: Date.now() });

    try {
      const response = await requestDeck({ ...args, signal: controller.signal });
      if (myId !== requestIdRef.current) return null; // stale: a newer request owns the UI now

      const { deck, warnings } = parseDeck(response.raw, {
        finishReason: response.finishReason,
        requestedCount: args.count,
      });
      setState({ status: "idle", error: null, startedAt: null });
      return { deck, warnings, model: response.model, text: args.text };
    } catch (err) {
      if (myId !== requestIdRef.current) return null; // stale or superseded: stay quiet

      let error;
      if (err.name === "AbortError") {
        if (!timedOut) {
          // User pressed Cancel.
          setState({ status: "idle", error: null, startedAt: null });
          return null;
        }
        error = new AppError("TIMEOUT", `No answer after ${CLIENT_TIMEOUT_MS / 1000} seconds. The AI may be overloaded.`);
      } else if (err instanceof DeckError) {
        error = new AppError(err.kind, DECK_ERROR_COPY[err.kind] || err.message, {
          retryable: true,
          details: err.kind === "NOT_STUDYABLE" ? null : err.message,
        });
      } else if (err instanceof AppError) {
        error = err;
      } else {
        console.error(err);
        error = new AppError("UNKNOWN", "Something unexpected went wrong.");
      }
      setState({ status: "error", error, startedAt: null });
      return null;
    } finally {
      clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => (lastArgsRef.current ? generate(lastArgsRef.current) : null), [generate]);

  const dismissError = useCallback(() => setState({ status: "idle", error: null, startedAt: null }), []);

  return { ...state, generate, cancel, retry, dismissError };
}
