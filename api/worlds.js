import { readJson, sendJson } from "../lib/http.js";
import { recordVote, snapshot } from "../lib/world-poll.js";
import { zenticPlayers } from "../lib/zentic.js";

/** The two worlds /learn offers; each id is also its vote key. */
const WORLDS = [
  { id: "survival", label: "Regular survival world" },
  { id: "bedwars", label: "Public Bedwars world" },
];

async function sendWorlds(res, status = 200) {
  const poll = snapshot();
  const players = await zenticPlayers();
  sendJson(res, status, {
    worlds: WORLDS.map((world) => ({ ...world, votes: poll.votes[world.id] })),
    total: poll.total,
    secondsLeft: poll.secondsLeft,
    resetAt: poll.resetAt,
    players,
  });
}

/** GET reads the poll and the live player count; POST records a vote for one world. */
export default async function handler(req, res) {
  if (req.method === "POST") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: "That request was not valid JSON." });
    }
    if (!recordVote(String(body?.world || ""))) {
      return sendJson(res, 400, { error: "Vote for survival or bedwars." });
    }
    return sendWorlds(res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Use GET to read the poll, POST to vote." });
  }
  return sendWorlds(res);
}
