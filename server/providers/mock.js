// A no-API-key provider. It makes fill-in-the-blank cards from your own sentences,
// which is enough to develop and demo the UI offline. It returns a JSON *string*,
// just like a real model, so it goes through exactly the same parsing path.

const STOPWORDS = new Set(
  "about above after again against because before being below between could during every their there these those through under until which while would should other where whose another".split(" ")
);

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 300);
}

// Pick the longest "interesting" word in a sentence as the thing to blank out.
function pickKeyword(sentence) {
  const words = sentence.match(/[A-Za-z][A-Za-z-]{4,}/g) || [];
  const candidates = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  return candidates.sort((a, b) => b.length - a.length)[0] || null;
}

function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildMockDeck(text, count) {
  const items = splitSentences(text)
    .map((sentence) => ({ sentence, keyword: pickKeyword(sentence) }))
    .filter((x) => x.keyword)
    .slice(0, count);

  const allKeywords = [...new Set(items.map((x) => x.keyword))];
  const extraWords = [...new Set(text.match(/[A-Za-z][A-Za-z-]{5,}/g) || [])];

  const blank = (s, k) => s.replace(new RegExp(`\\b${k}\\b`), "_____");

  const cards = items.map(({ sentence, keyword }) => ({
    front: `Fill in the blank: ${blank(sentence, keyword)}`,
    back: keyword,
  }));

  const quiz = items.map(({ sentence, keyword }, i) => {
    const distractors = [...allKeywords, ...extraWords]
      .filter((w) => w.toLowerCase() !== keyword.toLowerCase())
      .filter((w, idx, arr) => arr.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === idx)
      .slice(i, i + 3);
    const options = shuffle([keyword, ...distractors], i + 7);
    return {
      question: `Which word completes this? ${blank(sentence, keyword)}`,
      options,
      answerIndex: options.indexOf(keyword),
      explanation: `The original sentence was: "${sentence}"`,
    };
  });

  const firstWords = text.trim().split(/\s+/).slice(0, 5).join(" ");
  return { title: items.length ? `Notes: ${firstWords}…` : "", cards, quiz };
}

export async function generateWithMock({ text, count, signal }) {
  // Pretend to think for a moment so loading states are visible.
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 900);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
  });
  return { raw: JSON.stringify(buildMockDeck(text, count)), finishReason: "STOP", model: "mock" };
}
