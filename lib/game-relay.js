/**
 * The game relay: forwards Minecraft traffic to the camp server over two transports.
 *
 *   /game            a WebSocket pipe (the fast path)
 *   /game/http/*     request/response transport for networks whose proxy refuses WebSocket
 *
 * Both carry exactly the same frames to the same upstream, and both require the camp password
 * cookie. Nothing is inspected, decoded or stored: frames are forwarded byte for byte, and a
 * session is forgotten the moment it closes. See README "The relay" for the approval trail.
 */
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const MAX_SESSIONS = 64;
const IDLE_MS = 60_000;
const HOLD_MS = 20_000;
const MAX_BODY = 512 * 1024;
const DIAL_MS = 15_000;

function pack(frames) {
  let total = 0;
  for (const frame of frames) total += 4 + frame.length;
  const body = Buffer.alloc(total);
  let at = 0;
  for (const frame of frames) {
    body.writeUInt32BE(frame.length, at);
    at += 4;
    frame.copy(body, at);
    at += frame.length;
  }
  return body;
}

function unpack(buffer) {
  const frames = [];
  let at = 0;
  while (at + 4 <= buffer.length) {
    const length = buffer.readUInt32BE(at);
    at += 4;
    if (at + length > buffer.length) break;
    frames.push(buffer.subarray(at, at + length));
    at += length;
  }
  return frames;
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("packet too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function reply(res, status, data) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

export function createGameRelay({ upstream, isAllowed, log = () => {} }) {
  const sessions = new Map();

  function finish(id, reason) {
    const state = sessions.get(id);
    if (!state) return;
    sessions.delete(id);
    state.closed = true;
    clearInterval(state.timer);
    const waiter = state.waiter;
    state.waiter = null;
    if (waiter) waiter();
    try {
      state.upstream.terminate();
    } catch {
      /* already gone */
    }
    log(`session ${id} closed (${reason}); from client ${state.inBytes}B, from world ${state.outBytes}B`);
  }

  async function open(res) {
    if (sessions.size >= MAX_SESSIONS) {
      reply(res, 503, { error: "The relay is busy. Try again in a moment." });
      return;
    }

    const socket = new WebSocket(upstream, { perMessageDeflate: false });
    const connected = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), DIAL_MS);
      socket.once("open", () => {
        clearTimeout(timer);
        resolve(true);
      });
      socket.once("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    if (!connected) {
      try {
        socket.terminate();
      } catch {
        /* already gone */
      }
      reply(res, 502, { error: "The camp world did not answer." });
      return;
    }

    const id = randomUUID();
    const state = {
      upstream: socket,
      frames: [],
      waiter: null,
      closed: false,
      lastSeen: Date.now(),
      timer: null,
      inBytes: 0,
      outBytes: 0,
    };
    sessions.set(id, state);

    socket.on("message", (data) => {
      if (state.closed) return;
      const frame = Buffer.isBuffer(data) ? data : Buffer.from(data);
      state.outBytes += frame.length;
      state.frames.push(frame);
      const waiter = state.waiter;
      state.waiter = null;
      if (waiter) waiter();
    });
    socket.on("close", () => finish(id, "world disconnected"));
    socket.on("error", () => finish(id, "world error"));
    state.timer = setInterval(() => {
      if (Date.now() - state.lastSeen > IDLE_MS) finish(id, "idle");
    }, 5000);
    state.timer.unref?.();

    log(`session ${id} opened to ${upstream}`);
    reply(res, 200, { id });
  }

  function recv(id, res) {
    const state = sessions.get(id);
    if (!state) {
      reply(res, 410, { error: "This game session ended." });
      return;
    }
    state.lastSeen = Date.now();

    const flush = () => {
      if (!state.frames.length) return false;
      if (res.writableEnded || res.destroyed) return true;
      const body = pack(state.frames);
      state.frames = [];
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
      return true;
    };

    if (flush()) return;
    if (state.closed) {
      reply(res, 410, { error: "This game session ended." });
      return;
    }

    const settle = () => {
      clearTimeout(timer);
      if (state.waiter === settle) state.waiter = null;
      if (flush()) return;
      if (state.closed) {
        reply(res, 410, { error: "This game session ended." });
        return;
      }
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
    };
    const timer = setTimeout(settle, HOLD_MS);
    state.waiter = settle;
  }

  async function send(id, req, res) {
    const state = sessions.get(id);
    if (!state || state.closed) {
      reply(res, 410, { error: "This game session ended." });
      return;
    }
    state.lastSeen = Date.now();
    let body;
    try {
      body = await readBody(req, MAX_BODY);
    } catch {
      reply(res, 413, { error: "That packet is too large for this transport." });
      return;
    }
    state.inBytes += body.length;
    for (const frame of unpack(body)) {
      if (state.upstream.readyState === WebSocket.OPEN) state.upstream.send(frame, { binary: true });
    }
    if (!res.writableEnded) {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
    }
  }

  /** Returns true when the request belonged to the relay and has been answered. */
  async function handleHttp(req, res, pathname) {
    if (pathname !== "/game/http" && !pathname.startsWith("/game/http/")) return false;

    if (!isAllowed(req)) {
      reply(res, 403, { error: "Enter the camp password first." });
      return true;
    }
    if (pathname === "/game/http/ping") {
      if (!res.writableEnded) {
        res.writeHead(204, { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "same-origin" });
        res.end();
      }
      return true;
    }
    if (pathname === "/game/http/open") {
      if (req.method !== "POST") reply(res, 405, { error: "Use POST." });
      else await open(res);
      return true;
    }

    const match = pathname.match(/^\/game\/http\/([0-9a-fA-F-]{36})\/(send|recv|close)$/);
    if (!match) {
      reply(res, 404, { error: "No such relay route." });
      return true;
    }
    const [, id, action] = match;

    if (action === "recv" && req.method === "GET") recv(id, res);
    else if (action === "send" && req.method === "POST") await send(id, req, res);
    else if (action === "close" && req.method === "POST") {
      finish(id, "client closed");
      if (!res.writableEnded) {
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
      }
    } else reply(res, 405, { error: "Wrong method for this route." });
    return true;
  }

  function handleUpgrade(req, socket, head) {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname !== "/game" && pathname !== "/game/") {
      socket.destroy();
      return;
    }
    if (!isAllowed(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const protocols = (req.headers["sec-websocket-protocol"] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    // Dial the world first, so a dead server fails the join immediately instead of hanging.
    const world = new WebSocket(upstream, protocols, { perMessageDeflate: false });
    const gaveUp = () => {
      try {
        world.terminate();
      } catch {
        /* already gone */
      }
      socket.destroy();
    };
    socket.on("error", gaveUp);
    world.on("error", gaveUp);

    world.on("open", () => {
      world.off("error", gaveUp);
      relay.handleUpgrade(req, socket, head, (client) => bridge(client, world));
    });
  }

  const relay = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  function bridge(client, world) {
    let inBytes = 0;
    let outBytes = 0;
    log("websocket bridge opened");
    const close = () => {
      log(`websocket bridge closed; from client ${inBytes}B, from world ${outBytes}B`);
      try {
        client.close();
      } catch {
        /* already closed */
      }
      try {
        world.close();
      } catch {
        /* already closed */
      }
    };
    client.on("message", (data, isBinary) => {
      inBytes += data.length;
      if (world.readyState === WebSocket.OPEN) world.send(data, { binary: isBinary });
    });
    world.on("message", (data, isBinary) => {
      outBytes += data.length;
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });
    client.on("close", close);
    world.on("close", close);
    client.on("error", close);
    world.on("error", close);
  }

  return { handleHttp, handleUpgrade };
}
