function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

const LETTERS = "asdfjkl;ghqwertyuiopzxcvbnm".split("");
const WORDS_EASY = ["cat", "dog", "sun", "run", "big", "red", "toy", "hat", "map", "cup", "hop", "fun", "sky", "box", "pen"];
const WORDS_MED = ["apple", "castle", "forest", "garden", "purple", "rocket", "smile", "wonder", "dragon", "bubble", "friend", "puzzle"];
const SENTENCES = [
  "The magic town sparkles under the moonlight.",
  "Hirra solved the puzzle and unlocked a new room.",
  "Every kind word helps a pet grow happier.",
  "The bakery smells like warm cinnamon rolls.",
  "Practice makes your typing faster every day.",
];
const PARAGRAPHS = [
  "The three sisters explored the enchanted forest, collecting glowing seeds for the village garden. Each seed they planted made the town a little more magical.",
  "In the Magic Library, ancient books whispered stories of dragons and starlight. Reading carefully helped restore power to the old stone castle.",
  "Typing quickly and accurately unlocked the door to the Treasure Cave, where sparkling coins waited for the fastest fingers in the family.",
];

export function generateTypingPrompt(ageGroup, difficulty) {
  if (ageGroup === "5") {
    if (difficulty <= 3) return { topicKey: "typing.letters", type: "letters", text: pick(LETTERS) };
    return { topicKey: "typing.words", type: "words", text: pick(WORDS_EASY) };
  }
  if (ageGroup === "7") {
    if (difficulty <= 4) return { topicKey: "typing.words", type: "words", text: pick(WORDS_EASY) };
    if (difficulty <= 7) return { topicKey: "typing.words", type: "words", text: pick(WORDS_MED) };
    return { topicKey: "typing.sentences", type: "sentence", text: pick(SENTENCES) };
  }
  // age 12
  if (difficulty <= 4) return { topicKey: "typing.sentences", type: "sentence", text: pick(SENTENCES) };
  return { topicKey: "typing.paragraphs", type: "paragraph", text: pick(PARAGRAPHS) };
}

export function computeWpm(charsTyped, elapsedMs) {
  const minutes = elapsedMs / 60000;
  if (minutes <= 0) return 0;
  return Math.round(charsTyped / 5 / minutes);
}

export function computeAccuracy(correctChars, totalChars) {
  if (totalChars === 0) return 100;
  return Math.round((correctChars / totalChars) * 100);
}

export const KEYBOARD_ROWS = [
  "1234567890".split(""),
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

export default { generateTypingPrompt, computeWpm, computeAccuracy, KEYBOARD_ROWS };
