import { getQuest } from "../lib/quests.js";
import { runCode } from "../lib/sandbox.js";
import { readJson, sendJson } from "../lib/http.js";

// Gentle per-instance throttle: enough for a classroom, not enough for abuse.
const WINDOW_MS = 60_000;
const LIMIT = 90;
const hits = new Map();

function allow(key) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    if (hits.size > 500) {
      for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Post your code here with POST." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  if (!allow(ip)) {
    return sendJson(res, 429, { error: "Whoa, speedy! Take a breath and try again in a minute." });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "That request was not valid JSON." });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) return sendJson(res, 400, { error: "Write a little code first!" });

  let quest = null;
  if (body.questId) {
    quest = getQuest(String(body.questId));
    if (!quest) return sendJson(res, 404, { error: "We could not find that quest." });
  }

  const result = runCode(code, quest ? quest.tests : []);
  return sendJson(res, 200, {
    ...result,
    questId: quest ? quest.id : null,
    xp: quest && result.passed ? quest.xp : 0,
  });
}
