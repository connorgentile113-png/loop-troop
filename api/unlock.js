import { readJson, sendJson } from "../lib/http.js";
import { checkPassword, hasUnlock, isConfigured, setUnlockCookie } from "../lib/gate.js";

/** GET reports whether this browser is unlocked; POST trades the camp password for the cookie. */
export default async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    sendJson(res, 200, { locked: !hasUnlock(req), configured: isConfigured() });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use GET to check, POST to unlock." });
    return;
  }
  if (!isConfigured()) {
    sendJson(res, 503, { error: "This server has no camp password set yet." });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { error: 'Send {"password": "..."}.' });
    return;
  }

  if (!checkPassword(body?.password)) {
    sendJson(res, 401, { error: "That password is not right." });
    return;
  }

  setUnlockCookie(res);
  sendJson(res, 200, { ok: true });
}
