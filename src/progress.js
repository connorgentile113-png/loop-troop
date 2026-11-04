/** Tiny progress model: XP, levels, badges, saved locally in the browser. */

export const STORAGE_KEY = "loop-troop-v1";

export const LEVELS = [
  { min: 0, title: "Rookie Recruit", emoji: "🌱" },
  { min: 60, title: "Loop Cadet", emoji: "🛼" },
  { min: 140, title: "Bug Squasher", emoji: "🐛" },
  { min: 220, title: "Code Ranger", emoji: "🧭" },
  { min: 320, title: "Troop Legend", emoji: "🏆" },
];

export function defaultProgress() {
  return {
    name: "",
    done: {},
    drafts: {},
    arcadeBest: 0,
    playgroundRuns: 0,
    muted: false,
  };
}

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaultProgress();
    const base = defaultProgress();
    return {
      ...base,
      ...raw,
      done: raw.done && typeof raw.done === "object" ? raw.done : {},
      drafts: raw.drafts && typeof raw.drafts === "object" ? raw.drafts : {},
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* private mode, out of space — the session still works */
  }
}

export function xpFor(quests, progress) {
  return quests.reduce((sum, quest) => (progress.done[quest.id] ? sum + quest.xp : sum), 0);
}

export function doneCount(quests, progress) {
  return quests.filter((quest) => progress.done[quest.id]).length;
}

export function levelFor(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.min) current = level;
  return current;
}

export function nextLevelFor(xp) {
  return LEVELS.find((level) => level.min > xp) || null;
}

export function levelProgress(xp) {
  const level = levelFor(xp);
  const next = nextLevelFor(xp);
  if (!next) return { percent: 100, toNext: 0, next: null };
  const span = next.min - level.min;
  const gained = xp - level.min;
  return { percent: Math.round((gained / span) * 100), toNext: next.min - xp, next };
}

export function trackTotals(quests, trackId) {
  const list = quests.filter((quest) => quest.track === trackId);
  return { total: list.length, ids: list.map((quest) => quest.id) };
}

export function badgesFor(quests, progress) {
  const cleared = (trackId) => {
    const { total, ids } = trackTotals(quests, trackId);
    return total > 0 && ids.every((id) => progress.done[id]);
  };
  return [
    {
      id: "first",
      emoji: "🚀",
      name: "First Launch",
      hint: "Finish your first quest",
      earned: doneCount(quests, progress) >= 1,
    },
    {
      id: "basecamp",
      emoji: "🏕️",
      name: "Basecamp Boss",
      hint: "Clear all 6 basecamp quests",
      earned: cleared("basecamp"),
    },
    {
      id: "lagoon",
      emoji: "🌊",
      name: "Lagoon Legend",
      hint: "Clear all 4 lagoon quests",
      earned: cleared("lagoon"),
    },
    {
      id: "forest",
      emoji: "🌲",
      name: "Glitch Whisperer",
      hint: "Clear both Glitch Forest quests",
      earned: cleared("forest"),
    },
    {
      id: "arcade",
      emoji: "🕹️",
      name: "Bug Hunter",
      hint: "Score 8 or more in Bug Hunt",
      earned: progress.arcadeBest >= 8,
    },
    {
      id: "tinker",
      emoji: "🧪",
      name: "Tinkerer",
      hint: "Run anything in the playground",
      earned: progress.playgroundRuns > 0,
    },
  ];
}
