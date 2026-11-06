import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { createGameRelay } from "../lib/game-relay.js";

const source = await readFile(new URL("../lib/client-transport.js", import.meta.url), "utf8");

function client(base, mode = "http", fetchImpl = fetch) {
  const natives = [];
  const timers = [];
  class Native {
    constructor() { natives.push(this); }
    send(data) { (this.sent ||= []).push(data); }
    close() { const handler = this.onclose; queueMicrotask(() => handler?.({ code: 1006 })); }
  }
  const storage = new Map([["lt-ws-transport", mode]]);
  const window = { WebSocket: Native, location: { href: base }, localStorage: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
  } };
  vm.runInNewContext(source, {
    window, URL, AbortController, fetch: fetchImpl, ArrayBuffer, Uint8Array, DataView, TextEncoder, TextDecoder,
    setTimeout(fn, ms) { if (ms === 2500) { timers.push(fn); return 1; } return setTimeout(fn, ms); },
    clearTimeout,
  });
  return { socket: new window.WebSocket(base.replace(/^http/, "ws") + "/game"), natives, timers };
}

const pending = options => new Promise((resolve, reject) => {
  options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
});
const tick = () => new Promise(resolve => setImmediate(resolve));
function event(socket, type) {
  return new Promise((resolve, reject) => {
    socket.addEventListener(type, resolve);
    socket.addEventListener("error", e => reject(e.error));
  });
}

test("silent WebSocket falls back without an old close event killing HTTPS; replays in order", async () => {
  let resolveOpen;
  const sent = [];
  const { socket, natives, timers } = client("http://camp.test", "ws", async (url, opts) => {
    if (url.endsWith("/open")) return new Promise(resolve => { resolveOpen = resolve; });
    if (url.endsWith("/send")) { sent.push(opts.body); return { ok: true }; }
    if (url.endsWith("/recv")) return pending(opts);
    return { ok: true };
  });
  natives[0].onopen();
  socket.send("hello");
  assert.equal(natives[0].sent[0], "hello");
  timers.at(-1)();
  socket.send(new Uint8Array([2]));
  await tick();
  assert.equal(socket.readyState, 1);
  resolveOpen({ ok: true, json: async () => ({ id: "session" }) });
  await tick();
  assert.equal(socket.readyState, 1);
  const body = sent[0];
  assert.equal(new DataView(body.buffer).getUint32(0), 0x80000005);
  assert.equal(new TextDecoder().decode(body.slice(4, 9)), "hello");
  assert.equal(body.at(-1), 2);
  socket.close();
});

test("early native disconnect switches to HTTPS before the handshake is answered", async () => {
  let opens = 0;
  const { socket, natives } = client("http://camp.test", "ws", async (url, opts) => {
    if (url.endsWith("/open")) { opens++; return { ok: true, json: async () => ({ id: "session" }) }; }
    return pending(opts);
  });
  natives[0].onopen();
  natives[0].onclose({ code: 1006 });
  await tick();
  assert.equal(opens, 1);
  assert.equal(socket.readyState, 1);
  socket.close();
});

test("HTTP sends stay ordered and rejected sends surface an error", async () => {
  let finishFirst;
  let sends = 0;
  const { socket } = client("http://camp.test", "http", async (url, opts) => {
    if (url.endsWith("/open")) return { ok: true, json: async () => ({ id: "session" }) };
    if (url.endsWith("/send")) {
      sends++;
      if (sends === 1) return new Promise(resolve => { finishFirst = resolve; });
      return { ok: false, status: 410 };
    }
    return pending(opts);
  });
  await event(socket, "open");
  socket.send(new Uint8Array([1]));
  await new Promise(resolve => setTimeout(resolve, 15));
  socket.send(new Uint8Array([2]));
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(sends, 1);
  const failed = event(socket, "error");
  finishFirst({ ok: true });
  assert.match((await failed).message, /410/);
  assert.equal(sends, 2);
  assert.equal(socket.readyState, 3);
});

test("HTTPS-only client and relay preserve text and binary frames through a real upstream", { timeout: 10000 }, async t => {
  const world = new WebSocketServer({ port: 0 });
  await once(world, "listening");
  world.on("connection", ws => ws.on("message", (data, isBinary) => {
    ws.send(data, { binary: isBinary });
    if (data.toString() === "bye") ws.close();
  }));
  const relay = createGameRelay({ upstream: `ws://127.0.0.1:${world.address().port}`, isAllowed: req => req.headers.cookie === "unlocked" });
  const server = http.createServer(async (req, res) => {
    if (!(await relay.handleHttp(req, res, new URL(req.url, "http://localhost").pathname))) res.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    for (const ws of world.clients) ws.terminate();
    server.closeAllConnections();
    await Promise.all([new Promise(r => world.close(r)), new Promise(r => server.close(r))]);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + "/game/http/open", { method: "POST" })).status, 403);
  const { socket } = client(base, "http", (url, opts = {}) => fetch(url, {
    ...opts, headers: { ...opts.headers, cookie: "unlocked" },
  }));
  t.after(() => socket.close());
  await event(socket, "open");
  const received = [];
  const done = new Promise(resolve => socket.addEventListener("message", e => {
    received.push(e.data);
    if (received.length === 2) resolve();
  }));
  socket.send("Accept: MOTD");
  socket.send(new Uint8Array([0, 255, 128]));
  await done;
  assert.equal(received[0], "Accept: MOTD");
  assert.deepEqual([...new Uint8Array(received[1])], [0, 255, 128]);
  // Query servers often send their final reply and close before the next HTTP poll arrives.
  const opts = { method: "POST", headers: { cookie: "unlocked" } };
  const { id } = await fetch(base + "/game/http/open", opts).then(r => r.json());
  const packet = Buffer.alloc(7);
  packet.writeUInt32BE(0x80000003);
  packet.write("bye", 4);
  await fetch(`${base}/game/http/${id}/send`, { ...opts, body: packet });
  await new Promise(resolve => setTimeout(resolve, 30));
  const final = await fetch(`${base}/game/http/${id}/recv`, { headers: opts.headers });
  assert.equal(final.status, 200, "final upstream frames survive upstream close");
  assert.equal(Buffer.from(await final.arrayBuffer()).subarray(4).toString(), "bye");
  assert.equal((await fetch(`${base}/game/http/${id}/recv`, { headers: opts.headers })).status, 410);

});

test("a blocked WebSocket upgrade opens HTTPS once and announces open", async () => {
  let opens = 0;
  const { socket, timers } = client("http://camp.test", "ws", async (url, opts) => {
    if (url.endsWith("/open")) { opens++; return { ok: true, json: async () => ({ id: "session" }) }; }
    if (url.endsWith("/close")) return { ok: true };
    return pending(opts);
  });
  const opened = event(socket, "open");
  timers[0]();
  await opened;
  assert.equal(opens, 1);
  assert.equal(socket.readyState, 1);
  socket.close();
});

test("closing while HTTPS is opening releases the late session without reopening", async () => {
  let resolveOpen;
  let closed = 0;
  const { socket } = client("http://camp.test", "http", async url => {
    if (url.endsWith("/open")) return new Promise(resolve => { resolveOpen = resolve; });
    if (url.endsWith("/close")) closed++;
    return { ok: true };
  });
  socket.close();
  resolveOpen({ ok: true, json: async () => ({ id: "session" }) });
  await tick();
  assert.equal(socket.readyState, 3);
  assert.equal(closed, 1);
});

test("the shipped game embeds exactly the current transport before its bundle", async () => {
  const html = await readFile(new URL("../mc/eaglercraft.html", import.meta.url), "utf8");
  assert.equal(html.split(source.trim()).length - 1, 1);
  assert.equal(html.split("window.WebSocket = Shim;").length - 1, 1);
  assert.ok(html.indexOf(source.trim()) < html.indexOf("window.eaglercraftXClientScriptElement"));
  assert.match(html.slice(0, html.indexOf(source.trim())), /location\.host \+ "\/game"/);
});


test("game-style handleEvent objects can send the handshake and receive its response", async () => {
  let sends = 0;
  let resolveRecv;
  const { socket } = client("http://camp.test", "http", async (url, opts) => {
    if (url.endsWith("/open")) return { ok: true, json: async () => ({ id: "session" }) };
    if (url.endsWith("/send")) { sends++; return { ok: true }; }
    if (url.endsWith("/close")) return { ok: true };
    return new Promise((resolve, reject) => {
      resolveRecv = resolve;
      opts.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  });
  let opens = 0;
  const listener = { handleEvent(e) {
    assert.equal(this, listener, "object listeners retain their receiver");
    assert.equal(e.target, socket);
    opens++;
    socket.send(new Uint8Array([1, 3, 7]));
  } };
  socket.addEventListener("open", listener);
  socket.addEventListener("open", listener);
  socket.addEventListener("open", null);
  await event(socket, "open");
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(opens, 1);
  assert.equal(sends, 1, "the real game handshake leaves the browser");
  const received = new Promise(resolve => socket.addEventListener("message", {
    handleEvent(e) { resolve(e.data); },
  }));
  const frame = new Uint8Array([0, 0, 0, 3, 2, 4, 8]);
  resolveRecv({ ok: true, status: 200, arrayBuffer: async () => frame.buffer });
  assert.deepEqual([...new Uint8Array(await received)], [2, 4, 8]);
  let closes = 0;
  const removed = { handleEvent() { closes++; } };
  socket.addEventListener("close", removed);
  socket.removeEventListener("close", removed);
  socket.close();
  assert.equal(closes, 0);
});
