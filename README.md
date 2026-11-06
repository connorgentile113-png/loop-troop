# Loop Troop 🌀

Learn to code by playing. Free, interactive JavaScript quests for middle schoolers —
no sign-up, no setup, no install. Write real code in the browser, hit run, and pass the
server-side checks to earn XP and badges.

## What's inside

- **12 quests across 3 trails** — variables, strings, math, conditionals, logic, `for`/`while`
  loops, arrays, functions, debugging and a rock-paper-scissors boss quest. Every quest has
  two hints and an optional worked answer, so nobody gets stranded.
- **A real editor** with line numbers, tab support and `⌘/Ctrl + Enter` to run.
- **Server-side checks** — the browser never receives the tests. Code runs in a locked-down
  `node:vm` sandbox (no `require`, no `process`, no network, no `eval`, 3s timeout) inside a
  Vercel serverless function.
- **Bug Hunt arcade** — ten "what does this code do?" puzzles with explanations, score and streak.
- **Playground** — free-form sandbox with starter snippets.
- **XP, levels and six badges**, saved in `localStorage`. No accounts, no tracking, no cookies.

## Run it locally

```bash
npm run dev      # http://localhost:4321
npm test         # Node test runner: quest content + sandbox behaviour
```

One dependency — `ws`, for the `/game` relay. Everything else is static HTML/CSS/JS and plain Node
functions.

```bash
npm install
LEARN_PASSWORD='the camp password' npm start
```

## Deploy

The live site is a Render free web service built from `github.com/connorgentile113-png/loop-troop`:

```bash
git push        # Render rebuilds main automatically
```

`dev/server.js` is the production server, not just a dev convenience: it serves the static files,
routes `/api/*` to the functions in `api/`, gates `/mc/*` behind the camp password and relays
`/game` to the game server.

A Vercel copy still works for the quest app (`npx vercel --prod`), but it cannot host the gate or
the relay — a function cannot stream a 33 MB file or hold a WebSocket. Render is the site.

## Layout

```
index.html          app shell
src/app.js          state, routing, run/answer actions
src/views.js        HTML templates for each screen
src/progress.js     XP, levels, badges (localStorage)
src/arcade-data.js  Bug Hunt questions
src/fx.js           confetti + Web Audio chirps
lib/quests.js       quest content and the checks (server only)
lib/sandbox.js      vm runner
lib/gate.js         camp password + unlock cookie
api/quests.js       GET catalog
api/run.js          POST run code (+ gentle rate limit)
api/unlock.js       POST camp password
dev/server.js       the production server: static files, API, password gate, /game relay
tests/              node:test suite
```

## Education World (`/learn`)

A separate page (not linked from the quest app) with one job: get a camper into a shared Eaglercraft
world. Type the camp password, pick a name (kept in this browser only), then the client runs in an
iframe on the same page. The page is `noindex`.

### The camp password

The client will not start until the camper types the troop password, and the check is server-side:

- `POST /api/unlock` compares the password with `LEARN_PASSWORD` in constant time and, on a match,
  sets an `HttpOnly` cookie holding an HMAC of it (12 hours, so one school day).
- `dev/server.js` refuses `/mc/*` and refuses the `/game` WebSocket upgrade without that cookie.

So the gate is not decorative: without the password the 33 MB client is a 403 and the relay hangs
up. The password is never committed to this repo; set it in the environment and rotate it there.

```bash
LEARN_PASSWORD='...' npm start        # local
# Render: Dashboard → loop-troop → Environment → LEARN_PASSWORD
```

### The relay

`/game` on this host is a WebSocket relay to `wss://looptroop.eagler.host` (override with
`GAME_UPSTREAM`). The client's `joinServer` points at `/game` on the page's own host, so a
school network only has to allow this one site.

It is a plain byte pipe: it does not read, log or modify game traffic, and it dials the world first
so a dead server fails the join immediately instead of hanging. It is deliberately named and
documented rather than disguised — the school's admin approved running game traffic through this
URL — and it only accepts unlocked browsers, so it is not an open proxy for anyone else.

Some networks allow the site but refuse the WebSocket upgrade, which reaches the camper as
"handshake timed out". For those, `/game/http/*` carries the same frames as ordinary HTTPS requests
to this same origin. `lib/client-transport.js` (injected into the client at build time) keeps the
WebSocket fast path and switches only if the upgrade does not open or the world answers nothing; the
transport it ended up using is remembered in `localStorage` so a camper on a restricted network
connects quickly next time. Both transports forward to the same upstream — the relay has no other
destination. The wrapper supports both function listeners and `handleEvent` listener objects (used
by the actual game client), including on the HTTPS path. Frame types and ordering are preserved across the switch; HTTPS requests have bounded
timeouts. **Test connection** opens and closes an actual upstream connection, so a reachable site
is no longer mistaken for a reachable camp world.

### The client ships with the site

`/learn` is not a wrapper around somebody else's page: the client is served from this deployment at
`/mc/eaglercraft`, and the page makes **no requests to any third party** (no CDN, no font host, no
analytics). The launch options in that file prefill the camper's name from `?name=` and point the
client at this site's `/game` relay, with the vendor's relay list emptied.

`mc/eaglercraft.html` is built, not hand-edited:

```bash
node scripts/build-client.mjs              # downloads the official 1.8.8 zip (~13 MB)
node scripts/build-client.mjs some.zip     # or use a file you already have
```

It patches the official single-file build (33 MB) to (1) set Education World as the server,
(2) turn off analytics and the update/redirect services, (3) repoint the vendor's default relays at
our own server, and (4) fail the build if any third-party host survives. Rebuild it when the
upstream build changes; the output is committed because Vercel serves it as a static file.

Verified with headless Chrome against the local build: page loads, the WebGL canvas is live, the
options above are applied, and no request outside `loop-troop.vercel.app` is made.

## Notes for teachers

- Progress lives in the browser, so clearing site data resets it. There is no classroom
  dashboard and no data leaves the device beyond the code being run.
- The rate limit (90 runs/minute per IP) is per warm function instance, which is plenty for a
  class and keeps a runaway script from hammering the function.
- Sandboxing is layered (no globals, no dynamic code, timeout), but this is a teaching tool,
  not a security boundary for hostile code.
