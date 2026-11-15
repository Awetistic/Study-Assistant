export default function SessionList({ sessions, activeId, onOpen, onDelete, onClose }) {
  return (
    <aside className="sessions" aria-label="Saved decks">
      <div className="sessions__head">
        <h2>Saved decks</h2>
        <button className="btn btn--icon" onClick={onClose} aria-label="Close saved decks">
          ×
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="muted">Decks you generate are saved here, in this browser only.</p>
      ) : (
        <ul>
          {sessions.map((s) => (
            <li key={s.id} className={s.id === activeId ? "is-active" : ""}>
              <button className="sessions__open" onClick={() => onOpen(s.id)}>
                <span className="sessions__title">{s.deck.title}</span>
                <span className="muted">
                  {s.deck.cards.length} cards · {s.deck.quiz.length} questions · {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </button>
              <button className="btn btn--icon" onClick={() => onDelete(s.id)} aria-label={`Delete ${s.deck.title}`}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
