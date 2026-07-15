export const SUBTOPICS_BY_AGE = {
  5: ["pictureMatch", "sightWords"],
  7: ["synonyms", "antonyms", "sentenceCompletion", "wordBuilding"],
  12: ["prefixSuffix", "homophones", "advancedSynonyms", "contextMeaning"],
};

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

const PICTURE_WORDS = [
  { word: "cat", emoji: "🐱" }, { word: "dog", emoji: "🐶" }, { word: "sun", emoji: "☀️" },
  { word: "moon", emoji: "🌙" }, { word: "apple", emoji: "🍎" }, { word: "ball", emoji: "⚽" },
  { word: "tree", emoji: "🌳" }, { word: "fish", emoji: "🐟" }, { word: "book", emoji: "📖" },
  { word: "star", emoji: "⭐" }, { word: "flower", emoji: "🌸" }, { word: "house", emoji: "🏠" },
];

const SIGHT_WORDS = ["the", "and", "you", "is", "run", "see", "go", "we", "like", "play", "big", "small"];

const SYNONYMS = [
  { word: "happy", answer: "joyful", distractors: ["sad", "tired", "angry"] },
  { word: "big", answer: "large", distractors: ["tiny", "short", "thin"] },
  { word: "fast", answer: "quick", distractors: ["slow", "lazy", "still"] },
  { word: "smart", answer: "clever", distractors: ["silly", "sleepy", "loud"] },
  { word: "pretty", answer: "beautiful", distractors: ["messy", "plain", "dull"] },
  { word: "little", answer: "small", distractors: ["huge", "tall", "wide"] },
  { word: "brave", answer: "courageous", distractors: ["scared", "shy", "weak"] },
];

const ANTONYMS = [
  { word: "hot", answer: "cold", distractors: ["warm", "sunny", "wet"] },
  { word: "up", answer: "down", distractors: ["left", "near", "over"] },
  { word: "day", answer: "night", distractors: ["hour", "week", "sun"] },
  { word: "happy", answer: "sad", distractors: ["glad", "kind", "calm"] },
  { word: "fast", answer: "slow", distractors: ["loud", "high", "hard"] },
  { word: "open", answer: "closed", distractors: ["broken", "clean", "empty"] },
  { word: "light", answer: "dark", distractors: ["heavy", "bright", "soft"] },
];

const SENTENCES = [
  { sentence: "The sun is very ___ today.", answer: "bright", distractors: ["quiet", "square", "sleepy"] },
  { sentence: "She ___ to school every morning.", answer: "walks", distractors: ["paints", "sings", "melts"] },
  { sentence: "The kitten is ___ and fluffy.", answer: "soft", distractors: ["loud", "heavy", "sour"] },
  { sentence: "We planted a ___ in the garden.", answer: "seed", distractors: ["shoe", "cloud", "song"] },
  { sentence: "Please ___ the door quietly.", answer: "close", distractors: ["sing", "paint", "float"] },
];

const WORD_BUILDING = [
  { base: "play", suffix: "ing", answer: "playing", distractors: ["playd", "plaing", "playeding"] },
  { base: "jump", suffix: "ed", answer: "jumped", distractors: ["jumping", "jumpped", "jumpd"] },
  { base: "help", suffix: "ful", answer: "helpful", distractors: ["helply", "helpness", "helped"] },
  { base: "care", suffix: "less", answer: "careless", distractors: ["carely", "careness", "careful"] },
];

const PREFIX_SUFFIX = [
  { word: "un + happy", answer: "unhappy", distractors: ["rehappy", "happyun", "dishappy"], meaning: "not happy" },
  { word: "re + build", answer: "rebuild", distractors: ["unbuild", "buildre", "disbuild"], meaning: "build again" },
  { word: "care + ful", answer: "careful", distractors: ["careless", "caring", "carely"], meaning: "full of care" },
  { word: "mis + understand", answer: "misunderstand", distractors: ["reunderstand", "understandmis", "disunderstand"], meaning: "understand wrongly" },
  { word: "dis + agree", answer: "disagree", distractors: ["unagree", "agreedis", "misagree"], meaning: "not agree" },
];

const HOMOPHONES = [
  { clue: "Sounds like a number, means 'also': ___", answer: "two / to / too", options: ["to", "too", "two", "toe"], correctSet: ["to", "too", "two"] },
];

const ADVANCED_SYNONYMS = [
  { word: "enormous", answer: "gigantic", distractors: ["tiny", "average", "narrow"] },
  { word: "furious", answer: "enraged", distractors: ["calm", "content", "gentle"] },
  { word: "ancient", answer: "archaic", distractors: ["modern", "recent", "new"] },
  { word: "diligent", answer: "hardworking", distractors: ["lazy", "careless", "reckless"] },
  { word: "abundant", answer: "plentiful", distractors: ["scarce", "rare", "limited"] },
];

const CONTEXT_MEANING = [
  { sentence: "The archaeologists found ancient artifacts buried deep underground.", question: "What does 'artifacts' most likely mean?", answer: "objects made by humans in the past", distractors: ["types of rocks", "modern tools", "kinds of plants"] },
  { sentence: "Her meticulous planning meant nothing was left to chance.", question: "What does 'meticulous' mean?", answer: "extremely careful and precise", distractors: ["careless", "quick and rushed", "boring"] },
];

function gPictureMatch() {
  const target = pick(PICTURE_WORDS);
  const distractors = shuffle(PICTURE_WORDS.filter((w) => w.word !== target.word)).slice(0, 3);
  return { topicKey: "vocabulary.pictureMatch", prompt: `Which word matches? ${target.emoji}`, type: "choice", choices: shuffle([target.word, ...distractors.map((d) => d.word)]), answer: target.word };
}

function gSightWords() {
  const target = pick(SIGHT_WORDS);
  const distractors = shuffle(SIGHT_WORDS.filter((w) => w !== target)).slice(0, 3);
  return { topicKey: "vocabulary.sightWords", prompt: `Find the word: "${target}"`, type: "choice", choices: shuffle([target, ...distractors]), answer: target };
}

function gFromBank(bank, topicKey, promptFn) {
  const item = pick(bank);
  return { topicKey, prompt: promptFn(item), type: "choice", choices: shuffle([item.answer, ...item.distractors]), answer: item.answer };
}

function gWordBuilding() {
  const item = pick(WORD_BUILDING);
  return { topicKey: "vocabulary.wordBuilding", prompt: `Add "${item.suffix}" to "${item.base}":`, type: "choice", choices: shuffle([item.answer, ...item.distractors]), answer: item.answer };
}

function gPrefixSuffix() {
  const item = pick(PREFIX_SUFFIX);
  return { topicKey: "vocabulary.prefixSuffix", prompt: `Combine: ${item.word} (${item.meaning})`, type: "choice", choices: shuffle([item.answer, ...item.distractors]), answer: item.answer };
}

function gHomophones() {
  const item = pick(HOMOPHONES);
  return { topicKey: "vocabulary.homophones", prompt: item.clue, type: "choice", choices: shuffle(item.options), answer: item.options.find((o) => item.correctSet.includes(o)) };
}

function gContextMeaning() {
  const item = pick(CONTEXT_MEANING);
  return { topicKey: "vocabulary.contextMeaning", prompt: `${item.sentence}\n${item.question}`, type: "choice", choices: shuffle([item.answer, ...item.distractors]), answer: item.answer };
}

const GENERATORS = {
  pictureMatch: gPictureMatch,
  sightWords: gSightWords,
  synonyms: () => gFromBank(SYNONYMS, "vocabulary.synonyms", (i) => `Choose a word that means the same as "${i.word}":`),
  antonyms: () => gFromBank(ANTONYMS, "vocabulary.antonyms", (i) => `Choose the opposite of "${i.word}":`),
  sentenceCompletion: () => gFromBank(SENTENCES, "vocabulary.sentenceCompletion", (i) => i.sentence),
  wordBuilding: gWordBuilding,
  prefixSuffix: gPrefixSuffix,
  homophones: gHomophones,
  advancedSynonyms: () => gFromBank(ADVANCED_SYNONYMS, "vocabulary.advancedSynonyms", (i) => `Choose a word that means the same as "${i.word}":`),
  contextMeaning: gContextMeaning,
};

export function generateVocabQuestion(subtopic) {
  const gen = GENERATORS[subtopic] || gSynonymsFallback;
  return gen();
}
function gSynonymsFallback() { return gFromBank(SYNONYMS, "vocabulary.synonyms", (i) => `Choose a word that means the same as "${i.word}":`); }

export default { SUBTOPICS_BY_AGE, generateVocabQuestion };
