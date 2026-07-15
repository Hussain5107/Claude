function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

const STORIES = {
  5: [
    {
      id: "story5-1",
      title: "Meezab and the Sun",
      emoji: "☀️",
      text: "Meezab woke up. The sun was bright. She saw a cat. The cat said meow. Meezab smiled at the cat.",
      questions: [
        { q: "What did Meezab see?", answer: "a cat", choices: ["a cat", "a dog", "a bird"] },
        { q: "What did the cat say?", answer: "meow", choices: ["woof", "meow", "tweet"] },
      ],
    },
    {
      id: "story5-2",
      title: "The Little Garden",
      emoji: "🌷",
      text: "Meezab planted a seed. She gave it water. The sun made it warm. A flower grew big and pink.",
      questions: [
        { q: "What did Meezab plant?", answer: "a seed", choices: ["a seed", "a toy", "a shoe"] },
        { q: "What color was the flower?", answer: "pink", choices: ["blue", "pink", "black"] },
      ],
    },
  ],
  7: [
    {
      id: "story7-1",
      title: "Amal and the Lost Kitten",
      emoji: "🐱",
      text: "Amal Zahra was walking home from school when she heard a tiny meow near the old oak tree. She looked closely and found a small orange kitten stuck between two roots. Amal gently freed the kitten and carried it home in her jacket. She gave it warm milk and a soft blanket. The next day, she made posters to find the kitten's owner, but no one came. Amal decided to keep the kitten and named her Biscuit. From then on, Biscuit followed Amal everywhere in the garden.",
      questions: [
        { q: "Where did Amal find the kitten?", answer: "near the old oak tree", choices: ["near the old oak tree", "in her school bag", "at the bakery"] },
        { q: "What did Amal name the kitten?", answer: "Biscuit", choices: ["Biscuit", "Whiskers", "Luna"] },
        { q: "What did Amal give the kitten first?", answer: "warm milk", choices: ["a toy", "warm milk", "a hat"] },
      ],
    },
    {
      id: "story7-2",
      title: "The Rainy Day Bakery",
      emoji: "🍰",
      text: "It rained all morning, so Amal Zahra decided to help her grandmother bake cookies. They measured flour, cracked eggs, and stirred in chocolate chips. Amal's favorite part was rolling the dough into little balls. When the cookies came out of the oven, the whole kitchen smelled sweet. Amal packed a plate of cookies to share with her neighbors, who were delighted by the surprise.",
      questions: [
        { q: "Why did Amal bake indoors?", answer: "it was raining", choices: ["it was raining", "it was her birthday", "the oven broke"] },
        { q: "What was Amal's favorite part?", answer: "rolling the dough", choices: ["cracking eggs", "rolling the dough", "washing dishes"] },
        { q: "What did Amal do with the cookies?", answer: "shared them with neighbors", choices: ["ate them all", "shared them with neighbors", "sold them"] },
      ],
    },
  ],
  12: [
    {
      id: "story12-1",
      title: "Hirra and the Clockwork Library",
      emoji: "📚",
      text: "Deep beneath the Magic Library, Hirra discovered a room she had never seen before, filled with gears and glowing lanterns. An old clockwork owl perched on a shelf explained that the room housed the Town's memory — every book ever read by a villager was recorded here as a tiny spark of light. The owl warned that the sparks were fading because fewer children had been reading lately. Determined to help, Hirra spent the next several weeks organizing a reading challenge for the whole village, encouraging her sisters and friends to finish one book each week. Slowly, the lanterns brightened again, and the clockwork owl thanked her by revealing a hidden map to a new island none of them had explored before. Hirra realized that the simplest habits, like reading a little every day, could ripple outward and change an entire community.",
      questions: [
        { q: "What caused the lanterns to fade?", answer: "fewer children were reading", choices: ["fewer children were reading", "a storm damaged the library", "the owl left the village"] },
        { q: "What can we infer about the sparks of light?", answer: "they represent memories of reading", choices: ["they represent memories of reading", "they are a type of firefly", "they power the whole village"] },
        { q: "What reward did Hirra receive?", answer: "a hidden map to a new island", choices: ["a hidden map to a new island", "a golden book", "a new pet"] },
      ],
    },
    {
      id: "story12-2",
      title: "The Festival of Lights Dilemma",
      emoji: "🏮",
      text: "As the Village Festival approached, Hirra was put in charge of organizing the lantern displays, but she quickly realized there weren't enough coins in the town treasury to buy decorations for every street. Rather than giving up, she proposed a plan: instead of buying new lanterns, the villagers could craft their own using recycled paper and jars from the Bakery and Boutique. She organized workshops where younger children learned simple folding patterns while older villagers handled the wiring for the fairy lights. On the night of the festival, the streets glowed with hundreds of handmade lanterns, each one slightly different, and the villagers agreed it was more beautiful than anything they could have purchased. Hirra learned that creative problem-solving often produces better results than simply spending more.",
      questions: [
        { q: "What problem did Hirra face?", answer: "not enough coins for decorations", choices: ["not enough coins for decorations", "the festival date changed", "no one wanted to attend"] },
        { q: "What is the main lesson of the story?", answer: "creative problem-solving beats spending more", choices: ["creative problem-solving beats spending more", "festivals are expensive", "younger children can't help"] },
        { q: "Who helped with the wiring?", answer: "older villagers", choices: ["older villagers", "younger children", "no one"] },
      ],
    },
  ],
};

export function pickStory(ageGroup, excludeIds = []) {
  const pool = STORIES[ageGroup] || STORIES["7"];
  const available = pool.filter((s) => !excludeIds.includes(s.id));
  const list = available.length ? available : pool;
  return list[randInt(0, list.length - 1)];
}

export function questionWithShuffledChoices(question) {
  return { ...question, choices: shuffle(question.choices) };
}

export default { pickStory, questionWithShuffledChoices };
