/**
 * Builds mc/eaglercraft.html — the EaglercraftX 1.8 client served from our own origin.
 *
 * The official distribution is a single self-contained HTML file (about 33 MB) so the game
 * needs no CDN, no font host, no update service. This script takes that file and:
 *
 *   1. replaces the launch options so the client opens Education World with the camper's name,
 *   2. drops the Eaglercraft relay (an external WebSocket we do not use),
 *   3. turns analytics off and points its endpoint at our own origin,
 *   4. retitles the page,
 *   5. fails loudly if any third-party host is still referenced.
 *
 * Usage:
 *   node scripts/build-client.mjs path/to/eaglercraft1-8.zip
 *   node scripts/build-client.mjs path/to/eaglercraft1-8.html
 *   node scripts/build-client.mjs            # downloads the official zip
 *
 * Needs `unzip` on PATH when given a .zip.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "mc", "eaglercraft.html");
const ZIP_URL = "https://cdn.eaglercraft.net/objects/dl/1.8.8/eaglercraft1-8-62da5f39.zip";
const TMP_ZIP = join(process.env.TMPDIR || "/tmp", "eaglercraft1-8.zip");
const SERVER = "wss://looptroop.eagler.host";

/** Injected into <head>, before the client script, so the client boots with our world. */
const OPTS = `// %%%%%%%%% launch options %%%%%%%%%%%%%
// Patched by Loop Troop: Education World, served from this site.
window.eaglercraftXOpts = (function () {
	var opts = {
		container: "game_frame",
		worldsDB: "worlds",
		// No relays: the only connection this page makes is to our own server.
		relays: [],
		servers: [{ addr: "${SERVER}", name: "Education World", primary: true }],
		joinServer: "${SERVER}",
		// No update service, no redirects, no analytics leaving this origin.
		analytics: false,
		allowUpdateSvc: false,
		allowUpdateDL: false,
		allowServerRedirects: false
	};
	var name = "";
	try {
		name = (new URLSearchParams(location.search).get("name") || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
	} catch (e) {}
	if (name.length >= 3) opts.username = name;
	return opts;
})();
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;

// Any of these would mean the page can talk to a third party.
const FORBIDDEN = ["live.eaglercraft.org", "relay.eaglercraft.net", "cdn.eaglercraft.net"];

async function loadSource() {
  const arg = process.argv[2];
  if (arg) {
    if (extname(arg) === ".zip") return execFileSync("unzip", ["-p", arg], { maxBuffer: 256 * 1024 * 1024 });
    return readFile(arg);
  }
  console.log(`Downloading ${ZIP_URL} ...`);
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  // The 13 MB zip stays in tmp; only the built single-file client is kept in the repo.
  await writeFile(TMP_ZIP, Buffer.from(await res.arrayBuffer()));
  return execFileSync("unzip", ["-p", TMP_ZIP], { maxBuffer: 256 * 1024 * 1024 });
}

function patch(html) {
  const out = html.toString("utf8");
  let next = out;

  const optsBlock = /\/\/ %+ launch options %+[\s\S]*?\/\/ %{10,}/;
  if (!optsBlock.test(next)) throw new Error("could not find the launch options block");
  next = next.replace(optsBlock, OPTS);

  next = next.replace("<title>EaglercraftX 1.8</title>", "<title>Education World — Loop Troop</title>");
  next = next.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    '<meta property="og:description" content="Education World, hosted by Loop Troop." />',
  );
  next = next.replace(
    /<meta name="description" content="[^"]*" \/>/,
    '<meta name="description" content="Education World, hosted by Loop Troop." />',
  );
  // Analytics posts to live.eaglercraft.org; keep the code path but make it a same-origin 404.
  next = next.replaceAll("https://live.eaglercraft.org/api/event", "/mc/no-telemetry");

  // The bundle still carries the vendor's default relays (used for LAN/shared worlds). Point
  // them at our own server so no code path can reach a third party even if a camper explores.
  next = next.replaceAll("wss://relay.eaglercraft.net/", `${SERVER}/`);
  next = next.replaceAll("wss://relay.deev.is/", `${SERVER}/`);

  return next;
}

function check(html) {
  const problems = [];
  // The bundle reads/props window.eaglercraftXOpts too; only our own object assignment matters.
  const assignments = html.match(/window\.eaglercraftXOpts\s*=\s*\(function/g) || [];
  if (assignments.length !== 1) problems.push(`expected 1 launch-options assignment, found ${assignments.length}`);
  if (!html.includes(`joinServer: "${SERVER}"`)) problems.push("joinServer missing");
  if (!html.includes("analytics: false")) problems.push("analytics still enabled");
  if (!html.includes("relays: []")) problems.push("external relay list survived");
  for (const host of FORBIDDEN) {
    const hits = html.split(host).length - 1;
    if (hits > 0) problems.push(`${host} still referenced ${hits}x`);
  }
  if (problems.length) throw new Error(`build check failed:\n  - ${problems.join("\n  - ")}`);
  return { assignments: assignments.length };
}

const source = await loadSource();
const built = patch(source);
check(built);
await mkdir(join(ROOT, "mc"), { recursive: true });
await writeFile(OUT, built);
const { size } = await stat(OUT);
console.log(`Wrote mc/eaglercraft.html (${(size / 1048576).toFixed(1)} MB)`);
console.log("No third-party hosts referenced; server is", SERVER);
