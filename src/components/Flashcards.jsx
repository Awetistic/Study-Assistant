import { useCallback, useEffect, useMemo, useState } from "react";
import { shuffle } from "../lib/quiz.js";

/**
 * Flip-through flashcards. The user sorts each card into "got it" or "still learning";
 * at the end they can go round again with only the cards they're still learning.
 */
export default function Flashcards({ cards, active = true }) {
  const allIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const [order, setOrder] = useState(allIds);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => new Set());

  const finished = index >= order.length;
  const card = finished ? null : byId[order[index]];
  const learning = allIds.filter((id) => !known.has(id));

  const go = useCallback((next) => {
    setIndex(next);
    setFlipped(false);
  }, []);

  const mark = useCallback(
    (isKnown) => {
      if (!card) return;
      setKnown((prev) => {
        const next = new Set(prev);
        isKnown ? next.add(card.id) : next.delete(card.id);
        return next;
      });
      go(index + 1);
    },
    [card, index, go]
  );

  const restart = (ids) => {
    setOrder(ids);
    go(0);
  };

  // Keyboard: Space/Enter flip, ←/→ move, 1 = still learning, 2 = got it.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.target.closest("input, textarea, select")) return;
      if (finished) return;
      if (e.key === " " || e.key === "Enter") {
        // Let a focused button (e.g. "Got it") handle its own Enter/Space.
        if (e.target.closest("button") && !e.target.closest(".card")) return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") go(Math.min(index + 1, order.length));
      else if (e.key === "ArrowLeft") go(Math.max(index - 1, 0));
      else if (e.key === "1") mark(false);
      else if (e.key === "2") mark(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finished, index, order.length, go, mark]);

  if (finished) {
    return (
      <div className="round-end">
        <p className="round-end__score">
          <strong>{known.size}</strong> of {allIds.length} known
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(known.size / allIds.length) * 100}%` }} />
        </div>
        {learning.length > 0 ? (
          <p className="muted">{learning.length} still to learn.</p>
        ) : (
          <p className="muted">You know every card in this deck. 🎉</p>
        )}
        <div className="round-end__actions">
          {learning.length > 0 && (
            <button className="btn btn--primary" onClick={() => restart(shuffle(learning))}>
              Study the {learning.length} I'm still learning
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => restart(shuffle(allIds))}>
            Shuffle all
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setKnown(new Set());
              restart(allIds);
            }}
          >
            Reset progress
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcards">
      <div className="flashcards__meta">
        <span>
          Card {index + 1} of {order.length}
          {order.length < allIds.length && <span className="tag">still learning</span>}
        </span>
        <span className="muted">{known.size} known</span>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(index / order.length) * 100}%` }} />
      </div>

      <button
        className={`card ${flipped ? "is-flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Answer side. Click to show the question." : "Question side. Click to show the answer."}
      >
        <span className="card__inner">
          <span className="card__face card__face--front">
            <span className="card__label">Question</span>
            <span className="card__text">{card.front}</span>
            <span className="card__hint">Tap or press Space to flip</span>
          </span>
          <span className="card__face card__face--back">
            <span className="card__label">Answer</span>
            <span className="card__text">{card.back}</span>
          </span>
        </span>
      </button>

      <div className="flashcards__actions">
        <button className="btn btn--icon" onClick={() => go(Math.max(index - 1, 0))} disabled={index === 0} aria-label="Previous card">
          ←
        </button>
        <button className="btn btn--warn" onClick={() => mark(false)}>
          Still learning <kbd className="hide-mobile">1</kbd>
        </button>
        <button className="btn btn--success" onClick={() => mark(true)}>
          Got it <kbd className="hide-mobile">2</kbd>
        </button>
        <button className="btn btn--icon" onClick={() => go(index + 1)} aria-label="Skip card">
          →
        </button>
      </div>
    </div>
  );
}
