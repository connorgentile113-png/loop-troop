/**
 * The camp password in front of Education World.
 *
 * The password itself is never written in this repository: it comes from LEARN_PASSWORD. A correct
 * password gets an HttpOnly cookie holding an HMAC of it, so the server can recognise an unlocked
 * browser without keeping sessions and without ever sending the password back down.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "lt_unlock";

const SALT = "loop-troop-education-world";
const MAX_AGE = 60 * 60 * 12; // one school day

const secret = () => process.env.LEARN_PASSWORD || "";
const digest = (value) => createHmac("sha256", SALT).update(value).digest("hex");

const same = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

export const isConfigured = () => secret().length > 0;

export const checkPassword = (candidate) =>
  isConfigured() && typeof candidate === "string" && same(digest(candidate), digest(secret()));

export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export const hasUnlock = (req) => isConfigured() && same(readCookie(req, COOKIE_NAME), digest(secret()));

export function setUnlockCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${digest(secret())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}`,
  );
}
