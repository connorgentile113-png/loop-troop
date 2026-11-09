/**
 * Builds mc/eaglercraft.html — the EaglercraftX 1.8 client served from our own origin.
 *
 * The official distribution is a single self-contained HTML file (about 33 MB) so the game
 * needs no CDN, no font host, no update service. This script takes that file and:
 *
 *   1. replaces the launch options so the client opens the world picked on /learn, with the
 *      camper's name, and joins it straight away,
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
// The game connection goes to our own host; /game on that host relays it to the Minecraft server.
const SERVER = "wss://riverdaleacademy.devs.surf/game";
const SERVER_EXPR = '(location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/game"';
// The public Bedwars world. Joined directly: no relay of ours sits in front of it.
const ZENTIC = "wss://zentic.org";

/** Injected into <head>, before the client script, so the client boots with the world /learn picked. */
const OPTS = `// %%%%%%%%% launch options %%%%%%%%%%%%%
// Patched by Loop Troop: the world chosen on /learn, served from this site.
window.eaglercraftXOpts = (function () {
	var params;
	try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }
	// /learn sends ?world=survival or ?world=bedwars; anything else is the camp world.
	var world = params.get("world") === "bedwars" ? "bedwars" : "survival";
	var server = ${SERVER_EXPR};
	var zentic = "${ZENTIC}";
	var opts = {
		container: "game_frame",
		worldsDB: "worlds",
		// No third-party relays. Survival goes to our own /game relay, which forwards it to the
		// camp world; the Zentic world is joined directly, with nothing of ours in the middle.
		relays: [],
		servers: [
			{ addr: server, name: "Loop Troop Survival" },
			{ addr: zentic, name: "Zentic Bedwars" }
		],
		// The choice was already made on /learn, so skip the server list and join it now.
		joinServer: world === "bedwars" ? zentic : server,
		// No update service, no redirects, no analytics leaving this origin.
		analytics: false,
		allowUpdateSvc: false,
		allowUpdateDL: false,
		allowServerRedirects: false
	};
	var name = "";
	try {
		name = (params.get("name") || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
	} catch (e) {}
	if (name.length >= 3) opts.username = name;
	return opts;
})();
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`;

// Wraps window.WebSocket so the game can fall back to /game/http/* when a proxy refuses the
// WebSocket upgrade. Injected with the launch options, before the client script runs.
const TRANSPORT = await readFile(new URL("../lib/client-transport.js", import.meta.url), "utf8");

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

  // Rebuilding a previously patched client must replace the shim, not leave an old copy first.
  next = next.replace(/\/\* Injected into mc\/eaglercraft\.html[\s\S]*?window\.WebSocket = Shim;\s*\}\)\(\);\s*/g, "");
  const optsBlock = /\/\/ %+ launch options %+[\s\S]*?\/\/ %{10,}/;
  if (!optsBlock.test(next)) throw new Error("could not find the launch options block");
  next = next.replace(optsBlock, `${OPTS}\n${TRANSPORT}`);

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
  next = next.replaceAll("wss://relay.eaglercraft.net/", `${SERVER}`);
  next = next.replaceAll("wss://relay.deev.is/", `${SERVER}`);

  // Launch immediately: /learn supplies the three-second banner.
  next = next.replace("var launchSkipCountdown = false;", "var launchSkipCountdown = true;");
  return next;
}

function check(html) {
  const problems = [];
  // The bundle reads/props window.eaglercraftXOpts too; only our own object assignment matters.
  const assignments = html.match(/window\.eaglercraftXOpts\s*=\s*\(function/g) || [];
  if (assignments.length !== 1) problems.push(`expected 1 launch-options assignment, found ${assignments.length}`);
  if (!html.includes(`addr: zentic, name: "Zentic Bedwars"`) || !html.includes(`"${ZENTIC}"`)) problems.push("Zentic world missing");
  if (!html.includes('joinServer: world === "bedwars"')) problems.push("the /learn world choice is not wired up");
  if (html.includes("Arch MC") || html.includes("/arch")) problems.push("Arch MC is still offered");
  if (!html.includes("analytics: false")) problems.push("analytics still enabled");
  if (!html.includes("relays: []")) problems.push("external relay list survived");
  if (!html.includes("__loopTroopTransport")) problems.push("transport fallback missing");
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
console.log("No third-party hosts referenced; game connection is", SERVER);
