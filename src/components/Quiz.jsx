import { useEffect, useReducer } from "react";
import { buildRound, scoreRound } from "../lib/quiz.js";

/**
 * Quiz state lives in a reducer because several pieces change together
 * (answer + phase, round + index + answers). Each action is one user intent.
 */
function init(questions) {
  return { round: 1, retesting: false, items: buildRound(questions), index: 0, answers: {}, phase: "asking", history: [] };
}

function reducer(state, action) {
  switch (action.type) {
    case "answer":
      if (state.phase !== "asking") return state;
      return {
        ...state,
        answers: { ...state.answers, [state.items[state.index].id]: action.choice },
        phase: "feedback",
      };
    case "next":
      if (state.index + 1 >= state.items.length) return { ...state, phase: "results" };
      return { ...state, index: state.index + 1, phase: "asking" };
    case "retest": {
      const result = scoreRound(state.items, state.answers);
      const missed = action.questions.filter((q) => result.wrongIds.includes(q.id));
      return {
        round: state.round + 1,
        retesting: true,
        items: buildRound(missed),
        index: 0,
        answers: {},
        phase: "asking",
        history: [...state.history, result],
      };
    }
    case "restart":
      return init(action.questions);
    default:
      return state;
  }
}

export default function Quiz({ questions, active = true }) {
  const [state, dispatch] = useReducer(reducer, questions, init);
  const { items, index, answers, phase } = state;
  const current = items[index];
  const chosen = current ? answers[current.id] : undefined;

  // Keyboard: 1-6 to answer, Enter to continue.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.target.closest("input, textarea, select")) return;
      if (phase === "asking" && /^[1-6]$/.test(e.key)) {
        const choice = Number(e.key) - 1;
        if (choice < current.options.length) dispatch({ type: "answer", choice });
      } else if (phase === "feedback" && e.key === "Enter") {
        e.preventDefault();
        dispatch({ type: "next" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, phase, current]);

  if (phase === "results") {
    const result = scoreRound(items, answers);
    const pct = Math.round((result.correct / result.total) * 100);
    const missed = items.filter((q) => result.wrongIds.includes(q.id));
    return (
      <div className="round-end">
        <p className="eyebrow">{state.retesting ? `Round ${state.round} · re-test` : "Results"}</p>
        <p className="round-end__score">
          <strong>{result.correct}</strong> / {result.total} <span className="muted">({pct}%)</span>
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>

        {missed.length > 0 ? (
          <>
            <h3 className="review__title">To review</h3>
            <ul className="review">
              {missed.map((q) => (
                <li key={q.id}>
                  <p className="review__q">{q.question}</p>
                  <p className="review__a">
                    <span className="muted">You said:</span> {answers[q.id] !== undefined ? q.options[answers[q.id]] : "-"}
                    <br />
                    <span className="muted">Answer:</span> <strong>{q.options[q.answerIndex]}</strong>
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">{state.retesting ? "You've now got every question right. 🎉" : "Perfect score. 🎉"}</p>
        )}

        <div className="round-end__actions">
          {missed.length > 0 && (
            <button className="btn btn--primary" onClick={() => dispatch({ type: "retest", questions })}>
              Re-test the {missed.length} I missed
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => dispatch({ type: "restart", questions })}>
            Retake full quiz
          </button>
        </div>
      </div>
    );
  }

  const isCorrect = chosen === current.answerIndex;

  return (
    <div className="quiz">
      <div className="flashcards__meta">
        <span>
          Question {index + 1} of {items.length}
          {state.retesting && <span className="tag">re-test · round {state.round}</span>}
        </span>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(index / items.length) * 100}%` }} />
      </div>

      <h3 className="quiz__question">{current.question}</h3>

      <ul className="options" role="list">
        {current.options.map((opt, i) => {
          let cls = "option";
          if (phase === "feedback") {
            if (i === current.answerIndex) cls += " is-correct";
            else if (i === chosen) cls += " is-wrong";
            else cls += " is-dim";
          }
          return (
            <li key={i}>
              <button
                className={cls}
                onClick={() => dispatch({ type: "answer", choice: i })}
                disabled={phase !== "asking"}
                aria-pressed={chosen === i}
              >
                <span className="option__key">{i + 1}</span>
                <span>{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {phase === "feedback" && (
        <div className={`feedback ${isCorrect ? "feedback--good" : "feedback--bad"}`} aria-live="polite">
          <p>
            <strong>{isCorrect ? "Correct." : "Not quite."}</strong> {current.explanation || (!isCorrect && `The answer is "${current.options[current.answerIndex]}".`)}
          </p>
          <button className="btn btn--primary" onClick={() => dispatch({ type: "next" })} autoFocus>
            {index + 1 >= items.length ? "See results" : "Next"} <kbd className="hide-mobile">↵</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
