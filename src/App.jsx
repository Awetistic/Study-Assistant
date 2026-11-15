import { useEffect, useState } from "react";
import Composer from "./components/Composer.jsx";
import DeckView from "./components/DeckView.jsx";
import SessionList from "./components/SessionList.jsx";
import { LoadingState, ErrorState, EmptyState } from "./components/StatusViews.jsx";
import { useDeckGenerator } from "./hooks/useDeckGenerator.js";
import { fetchConfig } from "./lib/api.js";
import { loadSessions, saveSessions, newSessionId } from "./lib/storage.js";

export default function App() {
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? null);
  const [composerOpen, setComposerOpen] = useState(() => sessions.length === 0);
  const [showSessions, setShowSessions] = useState(false);
  const gen = useDeckGenerator();

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const active = sessions.find((s) => s.id === activeId) || null;

  // Shared by Generate and Retry. `result` is null when the request was cancelled,
  // failed (the error is shown from gen.error), or was superseded by a newer one.
  const addDeck = (result) => {
    if (!result) return;
    const session = { id: newSessionId(), createdAt: Date.now(), input: result.text, deck: result.deck, warnings: result.warnings };
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setComposerOpen(false);
  };

  const handleGenerate = async (args) => addDeck(await gen.generate(args));
  const handleRetry = async () => addDeck(await gen.retry());

  const openSession = (id) => {
    gen.cancel();
    gen.dismissError();
    setActiveId(id);
    setShowSessions(false);
    setComposerOpen(false);
  };

  const deleteSession = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setComposerOpen(true);
    }
  };

  let main;
  if (gen.status === "loading") {
    main = <LoadingState startedAt={gen.startedAt} onCancel={gen.cancel} />;
  } else if (gen.status === "error") {
    main = <ErrorState error={gen.error} onRetry={handleRetry} onDismiss={gen.dismissError} canGoBack={!!active} />;
  } else if (active) {
    // `key` gives each deck fresh flashcard/quiz state.
    main = <DeckView key={active.id} session={active} />;
  } else {
    main = <EmptyState />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span aria-hidden="true">◆</span> Study Assistant
        </h1>
        <div className="topbar__right">
          {config?.provider === "mock" && (
            <span className="badge" title="No API key set: using the offline fill-in-the-blank generator">
              Demo mode
            </span>
          )}
          <button className="btn btn--ghost" onClick={() => setShowSessions((v) => !v)} aria-expanded={showSessions}>
            Saved <span className="count">{sessions.length}</span>
          </button>
        </div>
      </header>

      {showSessions && (
        <SessionList sessions={sessions} activeId={activeId} onOpen={openSession} onDelete={deleteSession} onClose={() => setShowSessions(false)} />
      )}

      <main className="main">
        <Composer
          onGenerate={handleGenerate}
          loading={gen.status === "loading"}
          limits={config?.limits}
          simulateModes={config?.simulateModes}
          collapsed={!composerOpen && gen.status !== "loading"}
          onExpand={() => setComposerOpen(true)}
        />
        {main}
      </main>
    </div>
  );
}
