import { publicQuests, tracks } from "../lib/quests.js";
import { sendJson } from "../lib/http.js";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Use GET for quests." });
  }
  sendJson(res, 200, { tracks, quests: publicQuests }, "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
}
