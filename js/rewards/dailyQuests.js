const TASK_DEFS = [
  { type: "math", icon: "➕", label: "Answer {n} math questions", target: 5, reward: { coins: 10 } },
  { type: "typing", icon: "⌨️", label: "Complete {n} typing challenges", target: 5, reward: { coins: 10 } },
  { type: "reading", icon: "📖", label: "Finish {n} reading tasks", target: 3, reward: { coins: 10, stars: 1 } },
  { type: "puzzle", icon: "🧩", label: "Solve {n} puzzles", target: 2, reward: { coins: 10, stars: 1 } },
  { type: "decorate", icon: "🛋️", label: "Earn {n} decorating reward", target: 1, reward: { stars: 2 } },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function weekKey() {
  const d = new Date();
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - first) / 86400000 + first.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

/** Ensures draft.quests.daily has fresh tasks for today; mutates in place. */
export function ensureDailyQuests(draft) {
  const today = todayKey();
  if (draft.quests.daily.date === today) return draft.quests.daily;

  // Streak continues only if yesterday's quest set was completed.
  const wasYesterday = draft.quests.daily.lastCompletedDate === yesterdayKey();
  if (draft.quests.daily.date && !wasYesterday) {
    draft.quests.daily.streak = 0;
  }

  draft.quests.daily.date = today;
  draft.quests.daily.completed = false;
  draft.quests.daily.tasks = TASK_DEFS.map((def) => ({
    id: def.type,
    type: def.type,
    icon: def.icon,
    label: def.label.replace("{n}", def.target),
    target: def.target,
    progress: 0,
    done: false,
    reward: def.reward,
  }));
  return draft.quests.daily;
}

export function ensureWeeklyMissions(draft) {
  const wk = weekKey();
  if (draft.quests.weekly.weekKey === wk) return draft.quests.weekly;
  draft.quests.weekly = {
    weekKey: wk,
    completed: false,
    tasks: [
      { id: "festival", label: "Help host the Village Festival", target: 20, progress: 0, done: false, reward: { diamonds: 2 } },
      { id: "streakweek", label: "Keep a 7-day learning streak", target: 7, progress: 0, done: false, reward: { diamonds: 3 } },
    ],
  };
  return draft.quests.weekly;
}

/**
 * Advance quest progress for a given event type. Returns { completedTasks, questSetCompleted }.
 */
export function progressQuest(draft, type, amount = 1) {
  ensureDailyQuests(draft);
  const completedTasks = [];
  const task = draft.quests.daily.tasks.find((t) => t.type === type && !t.done);
  if (task) {
    task.progress = Math.min(task.target, task.progress + amount);
    if (task.progress >= task.target) {
      task.done = true;
      completedTasks.push(task);
    }
  }

  const weekly = ensureWeeklyMissions(draft);
  const wtask = weekly.tasks.find((t) => t.id === "streakweek");
  if (wtask) wtask.progress = draft.quests.daily.streak;

  let questSetCompleted = false;
  if (!draft.quests.daily.completed && draft.quests.daily.tasks.every((t) => t.done)) {
    draft.quests.daily.completed = true;
    draft.quests.daily.streak += 1;
    draft.quests.daily.lastCompletedDate = todayKey();
    questSetCompleted = true;
  }
  return { completedTasks, questSetCompleted };
}

export default { ensureDailyQuests, ensureWeeklyMissions, progressQuest };
