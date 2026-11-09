/**
 * Live player count for the Zentic network, shown on /learn.
 *
 * The count comes from the world itself: a standard 1.8 status ping over TCP, so no third-party
 * status service is involved. Answers are cached for half a minute, which is plenty for a picker
 * that refreshes every five seconds.
 */
import net from "node:net";

const HOST = process.env.ZENTIC_STATUS_HOST || "mc.zentic.cc";
const PORT = Number(process.env.ZENTIC_STATUS_PORT || 25565);
const PROTOCOL = 47; // 1.8, the version Eaglercraft speaks
const TIMEOUT_MS = 4000;
const CACHE_MS = 30_000;

function varint(value) {
  const bytes = [];
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest) byte |= 0x80;
    bytes.push(byte);
  } while (rest);
  return Buffer.from(bytes);
}

function readVarint(buffer, at) {
  let value = 0;
  let shift = 0;
  let cursor = at;
  for (;;) {
    if (cursor >= buffer.length) return null;
    const byte = buffer[cursor++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return [value, cursor];
    shift += 7;
    if (shift > 35) return null;
  }
}

function str(value) {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([varint(bytes.length), bytes]);
}

function parseStatus(buffer) {
  const packet = readVarint(buffer, 0);
  if (!packet) return null;
  const id = readVarint(buffer, packet[1]);
  if (!id || id[0] !== 0) return null;
  const length = readVarint(buffer, id[1]);
  if (!length) return null;
  const end = length[1] + length[0];
  if (buffer.length < end) return null;
  try {
    return JSON.parse(buffer.subarray(length[1], end).toString("utf8"));
  } catch {
    return null;
  }
}

function ping() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT });
    const chunks = [];
    let timer = null;
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };

    timer = setTimeout(() => done(null), TIMEOUT_MS);
    socket.on("error", () => done(null));
    socket.on("connect", () => {
      const port = Buffer.alloc(2);
      port.writeUInt16BE(PORT);
      const handshake = Buffer.concat([varint(0), varint(PROTOCOL), str(HOST), port, varint(1)]);
      socket.write(Buffer.concat([varint(handshake.length), handshake, varint(1), varint(0)]));
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      const status = parseStatus(Buffer.concat(chunks));
      if (!status || !status.players) return;
      done({ online: Number(status.players.online) || 0, max: Number(status.players.max) || 0 });
    });
  });
}

let cache = { at: 0, value: null };
let inflight = null;

/** `{ online, max }` for zentic.org, or null when the world cannot be reached. */
export function zenticPlayers() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  if (!inflight) {
    inflight = ping()
      .then((value) => {
        if (value) cache = { at: Date.now(), value };
        return value || cache.value;
      })
      .catch(() => cache.value)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
