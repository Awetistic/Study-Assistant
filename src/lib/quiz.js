// Pure helpers for quiz rounds - no React here, so they're easy to test and reason about.

export function shuffle(array, random = Math.random) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a round from a list of questions. Options are shuffled per round because
 * models tend to put the right answer in the same slot, and re-tests shouldn't be
 * answerable by remembering "it was the second one".
 */
export function buildRound(questions, random = Math.random) {
  return shuffle(questions, random).map((q) => {
    const order = shuffle(q.options.map((_, i) => i), random);
    return {
      id: q.id,
      question: q.question,
      explanation: q.explanation,
      options: order.map((i) => q.options[i]),
      answerIndex: order.indexOf(q.answerIndex),
    };
  });
}

export function scoreRound(items, answers) {
  const wrongIds = items.filter((q) => answers[q.id] !== q.answerIndex).map((q) => q.id);
  return { correct: items.length - wrongIds.length, total: items.length, wrongIds };
}
