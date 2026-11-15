import { useState } from "react";

const SAMPLE = `Photosynthesis is the process plants use to turn light energy into chemical energy. It happens mainly in the chloroplasts of leaf cells, which contain the green pigment chlorophyll. The light-dependent reactions take place in the thylakoid membranes and produce ATP, NADPH and oxygen, which is released as a by-product of splitting water. The Calvin cycle runs in the stroma and uses ATP and NADPH to fix carbon dioxide into glucose. The enzyme RuBisCO catalyses the first step of carbon fixation and is thought to be the most abundant protein on Earth. Factors that limit the rate of photosynthesis include light intensity, carbon dioxide concentration and temperature.`;

const COUNTS = [5, 8, 10, 15];

export default function Composer({ onGenerate, loading, limits, simulateModes, collapsed, onExpand }) {
  const [text, setText] = useState("");
  const [count, setCount] = useState(8);
  const [simulate, setSimulate] = useState("");

  const trimmed = text.trim();
  const min = limits?.minChars ?? 20;
  const max = limits?.maxChars ?? 15000;
  const tooShort = trimmed.length > 0 && trimmed.length < min;
  const tooLong = trimmed.length > max;
  const canSubmit = trimmed.length >= min && !tooLong;

  const submit = (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    onGenerate({ text: trimmed, count, simulate });
  };

  if (collapsed) {
    return (
      <div className="composer composer--collapsed">
        <p className="composer__summary">{trimmed ? `"${trimmed.slice(0, 90)}${trimmed.length > 90 ? "…" : ""}"` : "Make a new deck from your notes."}</p>
        <button className="btn btn--ghost" onClick={onExpand}>
          New deck
        </button>
      </div>
    );
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label htmlFor="notes" className="composer__label">
        Paste your notes, or type a topic
      </label>
      <textarea
        id="notes"
        className="composer__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        placeholder="e.g. The French Revolution: causes, key events from 1789 to 1799, and its outcomes…"
        rows={6}
        aria-describedby="notes-help"
      />
      <div id="notes-help" className={`composer__help ${tooShort || tooLong ? "is-error" : ""}`}>
        {tooShort && `A little more please, at least ${min} characters.`}
        {tooLong && `Too long by ${(trimmed.length - max).toLocaleString()} characters.`}
        {!tooShort && !tooLong && (
          <>
            {trimmed.length.toLocaleString()} / {max.toLocaleString()}
            {!trimmed && (
              <>
                {" · "}
                <button type="button" className="link" onClick={() => setText(SAMPLE)}>
                  Use sample notes
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="composer__row">
        <label className="field">
          <span>Items</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {simulateModes && (
          <label className="field field--simulate" title="Developer tool: make the server misbehave on purpose">
            <span>Simulate</span>
            <select value={simulate} onChange={(e) => setSimulate(e.target.value)}>
              <option value="">Off (real response)</option>
              {Object.entries(simulateModes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" className="btn btn--primary composer__submit" disabled={!canSubmit}>
          {loading ? "Start over with this" : "Generate"}
          <kbd className="hide-mobile">Ctrl ↵</kbd>
        </button>
      </div>
    </form>
  );
}
