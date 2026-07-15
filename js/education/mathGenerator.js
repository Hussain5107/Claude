export const SUBTOPICS_BY_AGE = {
  5: ["counting", "shapes", "addition", "subtraction"],
  7: ["addition", "subtraction", "multiplication", "time", "money", "patterns"],
  12: ["multiplication", "division", "fractions", "decimals", "percentages", "wordProblems"],
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function choicesAround(answer, spread, count = 4, isInt = true) {
  const set = new Set([answer]);
  while (set.size < count) {
    let delta = randInt(-spread, spread) || 1;
    let val = isInt ? Math.round(answer + delta) : Math.round((answer + delta) * 10) / 10;
    if (val < 0) val = Math.abs(val) + 1;
    set.add(val);
  }
  return shuffle([...set]);
}

const SHAPES = [
  { name: "circle", emoji: "🔵" }, { name: "square", emoji: "🟧" },
  { name: "triangle", emoji: "🔺" }, { name: "star", emoji: "⭐" },
  { name: "heart", emoji: "💗" },
];

function gCounting(difficulty) {
  const n = Math.min(20, randInt(1 + difficulty, 4 + difficulty * 2));
  const emoji = ["🍎", "🌸", "⭐", "🐟", "🎈"][randInt(0, 4)];
  return {
    topicKey: "math.counting",
    prompt: "How many do you see?",
    type: "visual-count",
    visual: emoji.repeat(n).split("").join(" "),
    visualItems: Array(n).fill(emoji),
    choices: choicesAround(n, 3),
    answer: n,
  };
}

function gShapes(difficulty) {
  const target = SHAPES[randInt(0, Math.min(SHAPES.length - 1, 2 + Math.floor(difficulty / 2)))];
  const options = shuffle(SHAPES.slice(0, Math.min(SHAPES.length, 3 + Math.floor(difficulty / 3)))).slice(0, 4);
  if (!options.includes(target)) options[0] = target;
  return {
    topicKey: "math.shapes",
    prompt: `Which one is the ${target.name}?`,
    type: "choice",
    choices: shuffle(options).map((s) => s.emoji),
    answer: target.emoji,
  };
}

function gAddition(difficulty, ageGroup) {
  const max = ageGroup === "5" ? 5 + difficulty : 10 + difficulty * 10;
  const a = randInt(1, max);
  const b = randInt(1, max);
  const answer = a + b;
  return { topicKey: "math.addition", prompt: `${a} + ${b} = ?`, type: "choice", choices: choicesAround(answer, 4 + difficulty), answer };
}

function gSubtraction(difficulty, ageGroup) {
  const max = ageGroup === "5" ? 5 + difficulty : 10 + difficulty * 10;
  const a = randInt(1, max);
  const b = randInt(0, a);
  const answer = a - b;
  return { topicKey: "math.subtraction", prompt: `${a} - ${b} = ?`, type: "choice", choices: choicesAround(answer, 4 + difficulty), answer };
}

function gMultiplication(difficulty) {
  const max = Math.min(12, 3 + Math.floor(difficulty * 1.1));
  const a = randInt(2, max);
  const b = randInt(2, max);
  const answer = a * b;
  return { topicKey: "math.multiplication", prompt: `${a} × ${b} = ?`, type: "choice", choices: choicesAround(answer, 10 + difficulty * 2), answer };
}

function gDivision(difficulty) {
  const b = randInt(2, Math.min(12, 3 + difficulty));
  const answer = randInt(2, Math.min(12, 3 + difficulty));
  const a = b * answer;
  return { topicKey: "math.division", prompt: `${a} ÷ ${b} = ?`, type: "choice", choices: choicesAround(answer, 5 + difficulty), answer };
}

function gTime(difficulty) {
  const hour = randInt(1, 12);
  const minuteOptions = difficulty < 5 ? [0, 30] : [0, 15, 30, 45];
  const minute = minuteOptions[randInt(0, minuteOptions.length - 1)];
  const label = minute === 0 ? `${hour}:00` : `${hour}:${minute}`;
  return { topicKey: "math.time", prompt: `What time does the clock show? 🕐 ${label}`, type: "choice", choices: shuffle([label, `${hour}:${(minute + 15) % 60 || 15}`, `${(hour % 12) + 1}:00`, `${hour}:${(minute + 30) % 60}`]), answer: label };
}

function gMoney(difficulty) {
  const coins = [1, 5, 10, 25];
  const count = randInt(2, 2 + Math.floor(difficulty / 2));
  let total = 0;
  const picked = [];
  for (let i = 0; i < count; i++) {
    const c = coins[randInt(0, Math.min(coins.length - 1, 1 + Math.floor(difficulty / 3)))];
    total += c;
    picked.push(`${c}¢`);
  }
  return { topicKey: "math.money", prompt: `Add the coins: ${picked.join(" + ")} = ?`, type: "choice", choices: choicesAround(total, 10), answer: total };
}

function gPatterns(difficulty) {
  const step = randInt(2, 2 + Math.floor(difficulty / 2));
  const start = randInt(1, 10);
  const seq = Array.from({ length: 4 }, (_, i) => start + i * step);
  const answer = start + 4 * step;
  return { topicKey: "math.patterns", prompt: `What comes next? ${seq.join(", ")}, ?`, type: "choice", choices: choicesAround(answer, step * 2), answer };
}

function gFractions(difficulty) {
  const den = randInt(2, Math.min(10, 3 + difficulty));
  const num = randInt(1, den - 1);
  const wholeParts = den;
  return {
    topicKey: "math.fractions",
    prompt: `What fraction is shaded? ${"●".repeat(num)}${"○".repeat(wholeParts - num)}`,
    type: "choice",
    choices: shuffle([`${num}/${den}`, `${den - num}/${den}`, `${num}/${den + 1}`, `${num + 1}/${den}`]),
    answer: `${num}/${den}`,
  };
}

function gDecimals(difficulty) {
  const a = Math.round((randInt(1, 5 + difficulty) + randInt(0, 9) / 10) * 10) / 10;
  const b = Math.round((randInt(1, 5 + difficulty) + randInt(0, 9) / 10) * 10) / 10;
  const answer = Math.round((a + b) * 10) / 10;
  return { topicKey: "math.decimals", prompt: `${a} + ${b} = ?`, type: "choice", choices: choicesAround(answer, 2, 4, false), answer };
}

function gPercentages(difficulty) {
  const percents = [10, 20, 25, 50, 75];
  const p = percents[randInt(0, Math.min(percents.length - 1, Math.floor(difficulty / 2)))];
  const base = randInt(1, 10) * 4;
  const answer = (p / 100) * base;
  return { topicKey: "math.percentages", prompt: `What is ${p}% of ${base}?`, type: "choice", choices: choicesAround(answer, Math.max(4, answer * 0.5)), answer };
}

function gWordProblems(difficulty) {
  const templates = [
    (n1, n2) => ({ prompt: `Hirra baked ${n1} cupcakes. She sold ${n2}. How many are left?`, answer: n1 - n2 }),
    (n1, n2) => ({ prompt: `Amal has ${n1} stickers and gets ${n2} more. How many now?`, answer: n1 + n2 }),
    (n1, n2) => ({ prompt: `There are ${n1} baskets with ${n2} apples each. How many apples total?`, answer: n1 * n2 }),
  ];
  const n1 = randInt(3 + difficulty, 10 + difficulty * 2);
  const n2 = randInt(2, Math.min(n1, 6 + difficulty));
  const tpl = templates[randInt(0, templates.length - 1)](n1, n2);
  return { topicKey: "math.wordProblems", prompt: tpl.prompt, type: "choice", choices: choicesAround(tpl.answer, 5 + difficulty), answer: tpl.answer };
}

const GENERATORS = {
  counting: gCounting, shapes: gShapes, addition: gAddition, subtraction: gSubtraction,
  multiplication: gMultiplication, division: gDivision, time: gTime, money: gMoney,
  patterns: gPatterns, fractions: gFractions, decimals: gDecimals, percentages: gPercentages,
  wordProblems: gWordProblems,
};

export function generateMathQuestion(subtopic, difficulty, ageGroup) {
  const gen = GENERATORS[subtopic] || gAddition;
  return gen(difficulty, ageGroup);
}

export default { SUBTOPICS_BY_AGE, generateMathQuestion };
