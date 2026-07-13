/**
 * Curated keyword categories relevant to YouTube's advertiser-friendly and
 * community guidelines, scoped to what's plausible in meditation/wellness
 * content. This is a heuristic keyword scan, not a legal/policy determination
 * — it catches obvious red flags; always review borderline content yourself
 * against YouTube's current policies before publishing.
 */
export const POLICY_KEYWORD_CATEGORIES: Record<string, string[]> = {
  "unsubstantiated medical claims": [
    "cures cancer",
    "cures anxiety",
    "cures depression",
    "guaranteed to heal",
    "guaranteed cure",
    "eliminates disease",
    "replaces medication",
    "replaces therapy",
    "heals depression",
    "treats ptsd",
    "cures insomnia permanently",
    "no more medication needed",
  ],
  "self-harm / crisis language (needs sensitive framing)": [
    "kill yourself",
    "suicidal thoughts",
    "want to die",
    "end my life",
    "self harm",
  ],
  "hate / violence": ["hate speech", "racial slur", "kill them", "ethnic cleansing"],
  "adult / sexual content": ["explicit sexual", "nsfw content", "pornographic"],
  "drugs / dangerous acts": ["how to make drugs", "overdose safely", "dangerous challenge"],
  "engagement manipulation": [
    "like and subscribe or",
    "share this or bad luck",
    "curse if you don't share",
    "will punish you if you skip",
    "bad luck if you don't",
  ],
  "gambling": ["guaranteed jackpot", "bet now", "casino bonus"],
};

/**
 * Extremely common stock-meditation opening lines. A match isn't a policy
 * violation, but it's a weak originality signal worth flagging — reviewers
 * (human or automated) that have seen thousands of meditation videos will
 * recognize these as boilerplate.
 */
export const GENERIC_OPENER_PATTERNS: string[] = [
  "welcome to this guided meditation find a comfortable position",
  "close your eyes and take a deep breath in",
  "find a quiet place where you will not be disturbed",
  "sit or lie down in a comfortable position and close your eyes",
  "get comfortable and close your eyes",
];
