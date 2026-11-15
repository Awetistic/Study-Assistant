# Study Assistant

Paste notes or a topic. An LLM returns flashcards and a multiple-choice quiz as JSON, and the app turns that into something you can study with: flip cards, sort them into "got it" / "still learning", take the quiz, and re-test only the questions you missed.

It is not a chatbot. The model's text is never shown directly; it is parsed, checked, and rendered as components.

## Run it

```bash
npm install
npm start
```

Open http://localhost:5173.

With no `.env`, the app runs in **Demo mode**: an offline generator makes fill-in-the-blank cards from your own sentences. Everything else works the same, so it's useful for checking the UI without a key.

To use a real model (Google Gemini, free tier):

```bash
cp .env.example .env
# put your key from https://aistudio.google.com/app/apikey into GEMINI_API_KEY
npm start
```

Other commands: `npm test` (parser and quiz logic tests), `npm run build`.

## How it fits together

```
Browser (React, Vite)                       Server (Express)                Gemini
Composer ──► useDeckGenerator ──► /api/generate ──► providers/gemini.js ──► generateContent
                 │                     (key stays here)     (or mock / simulate)
                 ▼
            parseDeck(raw)  ── extract JSON ─► validate item by item ─► { deck, warnings }
                 │
                 ▼
     DeckView ─► Flashcards  /  Quiz (useReducer, re-test rounds)
```

| Path | What it does |
|---|---|
| `server/index.js` | One route. Checks input, picks provider, server-side timeout, aborts the model call if the browser disconnects. |
| `server/providers/gemini.js` | Plain `fetch` to Gemini's REST API with a JSON schema. Returns the **raw text**. |
| `server/providers/mock.js` | No-key provider (fill-in-the-blank cards). |
| `server/simulate.js` | Makes the server misbehave on purpose, to demo error handling. |
| `src/lib/parseDeck.js` | Turns raw model text into a trusted deck, or a typed error. The core of the project. |
| `src/hooks/useDeckGenerator.js` | One request at a time: cancel, timeout, ignore stale responses. |
| `src/lib/quiz.js` | Pure quiz helpers: build a round (shuffles options), score it. |
| `src/lib/storage.js` | Saves decks to `localStorage` and re-validates them on load. |

## Handling bad AI output

The **Simulate** dropdown (shown when `ALLOW_SIMULATE=true`) triggers each case on demand.

| What goes wrong | What the user sees |
|---|---|
| JSON in ```` ```json ```` fences or with chatty text around it | Recovered. The deck shows, plus a small note. |
| Some items broken (missing answer, `answerIndex` out of range, one option, duplicates) | Bad items dropped, good ones kept; a note lists what was skipped. |
| `answerIndex: "2"` (string), or `answer: "Paris"` instead of an index | Coerced / matched. |
| Duplicate options | Removed, and the correct-answer index is remapped so it still points at the right text. |
| Cut off mid-JSON (token limit) | "The AI's answer was cut off" + Retry. |
| Valid JSON, wrong structure | "The AI answered the wrong question" + Retry. |
| Empty response | "The AI came back empty" + Retry. |
| Model says there's nothing to study | "Nothing to study there", with a hint to add detail. |
| Slow | Elapsed timer; "taking longer than usual" after 10s; gives up at 30s with Retry. Cancel button anytime. |
| 429 / 5xx / network down | Specific message + Retry. Bad input or a missing key shows no Retry, since retrying won't help. |
| A new request starts while an old one is running | Old request is aborted (browser and server). If its answer still arrives, a request-id check drops it, so it can't overwrite the newer deck. |
| Corrupted saved data in `localStorage` | Each saved deck goes back through the validator; bad ones are skipped, app doesn't crash. |

The Gemini JSON schema is a request, not a guarantee, so the client validates everything regardless of what the provider promises.

## Features

- Flashcards: flip (tap / Space), "Still learning" (1) / "Got it" (2), then study only the cards you're still learning, shuffle, reset.
- Quiz: answer with tap or 1–6, Enter for next, explanation after each answer, results with a review list, **re-test only the wrong answers** (repeat until all correct). Options are shuffled each round.
- Saved decks in the browser, re-openable from "Saved".
- Mobile layout, dark mode (follows the system), keyboard shortcuts, reduced-motion support.

## Known limitations

- No streaming. The whole JSON arrives before anything renders.
- No refinement ("make these harder"); each generation is a new deck.
- The model can still be **wrong in content** (a wrong "correct" answer). Validation catches broken structure, not factual errors.
- Very long notes are capped at 15,000 characters.
- Demo-mode cards are simple fill-in-the-blanks, not real understanding.
- Saved decks live only in this browser.

## What I'd do next

Streaming with partial rendering, a "refine this deck" prompt that edits the existing JSON, an option to edit or delete a bad card, and spaced repetition based on the "still learning" history.

## AI usage

<!-- Write this honestly in your own words. Example: -->
I used Claude to help scaffold the project and write first drafts of the components, the parser and the tests. I then read through, ran and tested the code, and changed ___. I can explain every file.

## Time spent

<!-- Fill in your real time. -->
About __ hours.
