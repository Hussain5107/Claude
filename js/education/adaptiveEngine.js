/**
 * Tracks per-topic accuracy/time and nudges difficulty (1-10) so every child
 * gets winnable-but-challenging questions. Age only seeds the starting band —
 * actual difficulty drifts from real performance (see docs/ARCHITECTURE.md §8).
 */
const AGE_BASELINE = { 5: 2, 7: 4, 12: 6 };
const WINDOW = 5;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

function ensureTopic(draft, topicKey, ageGroup) {
  if (!draft.education.topics[topicKey]) {
    draft.education.topics[topicKey] = {
      difficulty: AGE_BASELINE[ageGroup] || 3,
      attempts: 0,
      correct: 0,
      avgTimeMs: 0,
      mastery: 0,
      recent: [],
      lastSeen: null,
    };
  }
  return draft.education.topics[topicKey];
}

export function getDifficulty(draft, topicKey) {
  const t = ensureTopic(draft, topicKey, draft.ageGroup);
  return t.difficulty;
}

/** Records one answer and returns the (possibly updated) difficulty. */
export function recordAnswer(draft, topicKey, { correct, timeMs = 0 }) {
  const t = ensureTopic(draft, topicKey, draft.ageGroup);
  t.attempts += 1;
  if (correct) t.correct += 1;
  t.avgTimeMs = t.avgTimeMs === 0 ? timeMs : Math.round(t.avgTimeMs * 0.7 + timeMs * 0.3);
  t.recent.push(correct ? 1 : 0);
  if (t.recent.length > WINDOW) t.recent.shift();
  t.lastSeen = new Date().toISOString();

  const recentAccuracy = t.recent.reduce((a, b) => a + b, 0) / t.recent.length;
  t.mastery = Math.round(recentAccuracy * 100);

  if (t.recent.length >= 3) {
    if (recentAccuracy >= 0.8) t.difficulty = Math.min(MAX_DIFFICULTY, t.difficulty + 1);
    else if (recentAccuracy <= 0.4) t.difficulty = Math.max(MIN_DIFFICULTY, t.difficulty - 1);
  }
  return t.difficulty;
}

/** All topic keys under a subject prefix the child has touched, e.g. "math". */
export function topicsFor(draft, subjectPrefix) {
  return Object.keys(draft.education.topics).filter((k) => k.startsWith(`${subjectPrefix}.`));
}

/** Picks a topic biased toward weaker mastery so practice targets weak spots. */
export function pickWeightedTopic(draft, candidateTopicKeys) {
  const weights = candidateTopicKeys.map((key) => {
    const t = draft.education.topics[key];
    if (!t || t.attempts < 2) return 3; // unseen topics get a fair shot
    return Math.max(0.5, 3 - t.mastery / 50);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidateTopicKeys.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidateTopicKeys[i];
  }
  return candidateTopicKeys[candidateTopicKeys.length - 1];
}

export function weakTopics(draft, limit = 3) {
  return Object.entries(draft.education.topics)
    .filter(([, t]) => t.attempts >= 3)
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .slice(0, limit)
    .map(([key]) => key);
}

export function strongTopics(draft, limit = 3) {
  return Object.entries(draft.education.topics)
    .filter(([, t]) => t.attempts >= 3)
    .sort((a, b) => b[1].mastery - a[1].mastery)
    .slice(0, limit)
    .map(([key]) => key);
}

export default { getDifficulty, recordAnswer, topicsFor, pickWeightedTopic, weakTopics, strongTopics };
