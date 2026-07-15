const SYMBOL_POOL = ["🐱", "🐶", "🦋", "🌸", "⭐", "🍎", "🐰", "🦄", "🐼", "🌈", "🎈", "🐟", "🌙", "🍭", "🦊", "🐸", "🍩", "🧸", "🌻", "🐬"];

const GRID_BY_AGE = { 5: 4, 7: 6, 12: 9 };

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

/** Returns a shuffled array of card objects {id, symbol, matched, flipped}. */
export function generateMemoryDeck(ageGroup, difficulty = 5) {
  const basePairs = GRID_BY_AGE[ageGroup] || 6;
  const pairs = Math.min(SYMBOL_POOL.length, basePairs + Math.floor(difficulty / 5));
  const symbols = shuffle(SYMBOL_POOL).slice(0, pairs);
  const deck = shuffle([...symbols, ...symbols]).map((symbol, i) => ({
    id: `card-${i}-${symbol}`,
    symbol,
    matched: false,
    flipped: false,
  }));
  return deck;
}

export function gridColumnsFor(deckSize) {
  if (deckSize <= 8) return 4;
  if (deckSize <= 12) return 4;
  if (deckSize <= 16) return 4;
  return 5;
}

export default { generateMemoryDeck, gridColumnsFor };
