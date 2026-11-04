/**
 * The server for Loop Troop: static files, /api/* functions, the password gate in front of the
 * game client, and the game relay (/game over WebSocket, /game/http/* over plain HTTPS).
 *
 * It runs locally (`npm start`) and in production on Render.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { hasUnlock } from "../lib/gate.js";
import { createGameRelay } from "../lib/game-relay.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 4321);

/**
 * Where the relay forwards game traffic. This is the camp's Minecraft server, not ours.
 * Both transports forward to it unchanged; neither reads or records what passes through.
 */
const GAME_UPSTREAM = process.env.GAME_UPSTREAM || "wss://looptroop.eagler.host";

const relay = createGameRelay({
  upstream: GAME_UPSTREAM,
  isAllowed: hasUnlock,
  log: (message) => console.log(`relay: ${message}`),
});

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (await relay.handleHttp(req, res, pathname)) return;

  if (pathname.startsWith("/api/")) {
    const route = pathname.slice(5).replace(/\/$/, "");
    if (!/^[a-z-]+$/.test(route)) {
      res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    try {
      const { default: handler } = await import(`../api/${route}.js`);
      await handler(req, res);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // The 33 MB client is only served to a browser that typed the camp password.
  if (pathname === "/mc" || pathname.startsWith("/mc/")) {
    if (!hasUnlock(req)) {
      res.writeHead(403, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(
        "<!doctype html><meta charset=\"utf-8\"><title>Locked</title>" +
          "<body style=\"font:16px/1.6 system-ui;padding:32px\">" +
          "<h1>Education World is locked</h1>" +
          "<p>Type the camp password on <a href=\"/learn\">/learn</a> to open the game.</p>",
      );
      return;
    }
  }

  const relative = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, relative);
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    // Clean URLs: /learn serves learn.html. Mirrors Vercel's routing.
    if (!file.endsWith(".html")) {
      try {
        const body = await readFile(`${file}.html`);
        res.writeHead(200, { "Content-Type": types[".html"] });
        res.end(body);
        return;
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>That page wandered off. <a href='/'>Back to camp</a></p>");
  }
});

server.on("upgrade", relay.handleUpgrade);

server.listen(port, "0.0.0.0", () => {
  console.log(`Loop Troop is running at http://localhost:${port}`);
  console.log(`game relay: /game + /game/http/* -> ${GAME_UPSTREAM}`);
});
