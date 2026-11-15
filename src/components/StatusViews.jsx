import { useEffect, useState } from "react";
import { CLIENT_TIMEOUT_MS } from "../hooks/useDeckGenerator.js";

export function LoadingState({ startedAt, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const slow = seconds >= 10;

  return (
    <section className="panel status" aria-live="polite" aria-busy="true">
      <div className="status__head">
        <span className="spinner" aria-hidden="true" />
        <div>
          <h2>Writing your flashcards and quiz…</h2>
          <p className="muted">
            {slow
              ? `Taking longer than usual (${seconds}s). We'll stop waiting at ${CLIENT_TIMEOUT_MS / 1000}s.`
              : `${seconds}s`}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="skeleton" aria-hidden="true">
        <div className="skeleton__card" />
        <div className="skeleton__line" />
        <div className="skeleton__line skeleton__line--short" />
      </div>
    </section>
  );
}

const ERROR_TITLES = {
  TIMEOUT: "That took too long",
  NETWORK: "Can't reach the server",
  RATE_LIMIT: "Too many requests",
  UPSTREAM: "The AI service had a problem",
  SERVER: "Server error",
  NO_KEY: "The server isn't set up yet",
  BAD_INPUT: "Check your input",
  BLOCKED: "The AI declined this text",
  NOT_STUDYABLE: "Nothing to study there",
  EMPTY: "The AI came back empty",
  MALFORMED: "The AI's answer was garbled",
  TRUNCATED: "The AI's answer was cut off",
  WRONG_SHAPE: "The AI answered the wrong question",
  NO_USABLE_ITEMS: "Nothing usable came back",
};

export function ErrorState({ error, onRetry, onDismiss, canGoBack }) {
  return (
    <section className="panel status status--error" role="alert">
      <h2>{ERROR_TITLES[error.kind] || "Something went wrong"}</h2>
      <p>{error.message}</p>
      {error.details && (
        <details className="status__details">
          <summary>Details</summary>
          <code>{error.details}</code>
        </details>
      )}
      <div className="status__actions">
        {error.retryable && (
          <button className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        )}
        <button className="btn btn--ghost" onClick={onDismiss}>
          {canGoBack ? "Back to my deck" : "Dismiss"}
        </button>
      </div>
    </section>
  );
}

export function EmptyState() {
  return (
    <section className="panel empty">
      <h2>Turn notes into something you can practise</h2>
      <ol className="empty__steps">
        <li>
          <strong>Paste</strong> lecture notes, a textbook paragraph, or just a topic.
        </li>
        <li>
          <strong>Flip</strong> through flashcards and sort them into "got it" and "still learning".
        </li>
        <li>
          <strong>Quiz</strong> yourself, then re-test only the questions you missed until they stick.
        </li>
      </ol>
      <p className="muted">Your decks are saved in this browser so you can come back to them.</p>
    </section>
  );
}
