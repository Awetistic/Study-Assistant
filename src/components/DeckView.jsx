import { useState } from "react";
import Flashcards from "./Flashcards.jsx";
import Quiz from "./Quiz.jsx";

export default function DeckView({ session }) {
  const { deck, warnings } = session;
  const [tab, setTab] = useState(deck.cards.length ? "cards" : "quiz");
  const [showWarnings, setShowWarnings] = useState(true);

  return (
    <section className="panel deck">
      <header className="deck__header">
        <h2 className="deck__title">{deck.title}</h2>
        <div className="tabs" role="tablist" aria-label="Study mode">
          <button role="tab" aria-selected={tab === "cards"} className="tabs__tab" onClick={() => setTab("cards")} disabled={!deck.cards.length}>
            Flashcards <span className="count">{deck.cards.length}</span>
          </button>
          <button role="tab" aria-selected={tab === "quiz"} className="tabs__tab" onClick={() => setTab("quiz")} disabled={!deck.quiz.length}>
            Quiz <span className="count">{deck.quiz.length}</span>
          </button>
        </div>
      </header>

      {showWarnings && warnings.length > 0 && (
        <div className="notice" role="status">
          <div>
            <strong>Heads up: the AI's answer wasn't perfect.</strong>
            <ul>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <button className="btn btn--icon" onClick={() => setShowWarnings(false)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* Both stay mounted so switching tabs doesn't lose your place. */}
      <div role="tabpanel" hidden={tab !== "cards"}>
        {deck.cards.length > 0 && <Flashcards cards={deck.cards} active={tab === "cards"} />}
      </div>
      <div role="tabpanel" hidden={tab !== "quiz"}>
        {deck.quiz.length > 0 && <Quiz questions={deck.quiz} active={tab === "quiz"} />}
      </div>
    </section>
  );
}
